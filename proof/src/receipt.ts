/**
 * Receipt core and package shapes (PRODUCT_ARCHITECTURE.md §14, PBX-015).
 * The receiptCore is what gets canonicalized, hashed, and signed.
 * cryptographicProof and anchorProof sit OUTSIDE the signed bytes.
 */

export const SCHEMA = "onbehalf.action-receipt";
export const SCHEMA_VERSION = "0.1.0";

/** The string whose SHA-256 becomes the on-chain bytes32 schemaId. */
export function schemaIdString(schema: string = SCHEMA, version: string = SCHEMA_VERSION): string {
  return `${schema}@${version}`;
}

export type PolicyDecision = "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
export type ApprovalDecision = "APPROVED" | "REJECTED" | "NOT_REQUIRED";
export type ObservedState = "SUCCEEDED" | "FAILED" | "UNKNOWN";
export type EvidenceLevel =
  | "REQUEST_RECORDED"
  | "POLICY_EVALUATED"
  | "GATEWAY_ATTEMPTED"
  | "PROVIDER_OBSERVED"
  | "PROVIDER_CONFIRMED";

export interface ReceiptCore {
  schema: string;
  schemaVersion: string;
  receiptId: string;
  issuedAt: string;
  issuer: { issuerId: string; keyId: string };
  scope: { environment: string; coveredRoute: string; coverageClaim: string };
  subject: { organizationRef: string; agentRef: string; agentVersion: string };
  authority: {
    mandateRef: string;
    mandateVersion: number;
    mandateDigest: string;
    activeAtEvaluation: boolean;
    activeAtExecution: boolean;
  };
  action: {
    actionId: string;
    actionVersion: number;
    actionType: string;
    targetRef: string;
    amountMinor: number;
    currency: string;
    requestDigest: string;
  };
  policy: {
    policyRef: string;
    policyVersion: number;
    policyDigest: string;
    decision: PolicyDecision;
    reasonCodes: string[];
    evaluatedAt: string;
  };
  approval: {
    required: boolean;
    decision: ApprovalDecision;
    approverRef: string;
    bindingDigest: string;
    decidedAt: string;
  };
  execution: {
    provider: string;
    providerEnvironment: string;
    operationRef: string;
    providerObjectRef: string;
    attemptedAt: string;
    observedState: ObservedState;
    observedAt: string;
    observationSources: string[];
  };
  evidence: {
    level: EvidenceLevel;
    recordedEventCount: number;
    evidenceManifestDigest: string;
    limitations: string[];
  };
  /** 256-bit random, base64url (PBX-011). Signed, never published alone. */
  commitmentNonce: string;
}

export interface CryptographicProof {
  canonicalization: "RFC8785-JCS";
  digestAlgorithm: "SHA-256";
  /** 0x + lowercase hex SHA-256 of the canonical receiptCore bytes. */
  digest: string;
  signatureAlgorithm: "Ed25519";
  /** base64url, 64 bytes. */
  signature: string;
  /** base64url, raw 32-byte Ed25519 public key. */
  publicKey: string;
  /** sha256:<hex> over the raw public key. */
  publicKeyFingerprint: string;
}

export type AnchorState = "NOT_SUBMITTED" | "PENDING" | "ANCHORED" | "FAILED";

export interface AnchorProof {
  state: AnchorState;
  chainId?: number;
  contractAddress?: string;
  issuerAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  blockHash?: string;
  confirmationsObserved?: number;
  /** 0x + hex SHA-256 of schemaIdString(). */
  schemaId?: string;
  submittedAt?: string;
  observedAt?: string;
  /** Human-readable reason for NOT_SUBMITTED / PENDING / FAILED. */
  reason?: string;
}

export interface ReceiptPackage {
  receiptCore: ReceiptCore;
  cryptographicProof: CryptographicProof;
  anchorProof: AnchorProof;
}
