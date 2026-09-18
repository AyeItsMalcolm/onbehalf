/**
 * Read-only chain access for the verifier's Anchor check, via viem.
 * Implemented and env-driven; NOT run in the demo (PBX-021).
 * Needs no private key: every call here is a public read.
 */
import { createPublicClient, defineChain, http, parseAbi, type Hex } from "viem";
import { bscTestnet } from "viem/chains";
import type { AnchorReader } from "../verifier/core.js";

export const EVIDENCE_ANCHOR_ABI = parseAbi([
  "event EvidenceCommitted(address indexed issuer, bytes32 indexed digest, bytes32 indexed schemaId)",
  "function commit(bytes32 digest, bytes32 schemaId)",
  "function committedAtBlock(address issuer, bytes32 digest) view returns (uint256)",
]);

export function chainFor(chainId: number, rpcUrl: string) {
  if (chainId === bscTestnet.id) return bscTestnet;
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "NATIVE", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function createAnchorReader(opts: { rpcUrl: string; chainId: number }): AnchorReader {
  const client = createPublicClient({ chain: chainFor(opts.chainId, opts.rpcUrl), transport: http(opts.rpcUrl) });

  return {
    chainId: () => client.getChainId(),
    committedAtBlock: (contract, issuer, digest) =>
      client.readContract({
        address: contract as Hex,
        abi: EVIDENCE_ANCHOR_ABI,
        functionName: "committedAtBlock",
        args: [issuer as Hex, digest as Hex],
      }),
    blockHash: async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      return block?.hash ?? null;
    },
    latestBlockNumber: () => client.getBlockNumber(),
    commitEventPresent: async (txHash, contract, issuer, digest, schemaId) => {
      const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
      if (receipt.status !== "success") return false;
      if (receipt.to?.toLowerCase() !== contract.toLowerCase()) return false;
      const { parseEventLogs } = await import("viem");
      const events = parseEventLogs({ abi: EVIDENCE_ANCHOR_ABI, logs: receipt.logs, eventName: "EvidenceCommitted" });
      return events.some(
        (e) =>
          e.address.toLowerCase() === contract.toLowerCase() &&
          e.args.issuer.toLowerCase() === issuer.toLowerCase() &&
          e.args.digest.toLowerCase() === digest.toLowerCase() &&
          e.args.schemaId.toLowerCase() === schemaId.toLowerCase(),
      );
    },
  };
}
