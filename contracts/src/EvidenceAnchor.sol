// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title EvidenceAnchor
/// @notice A minimal public witness for receipt digests.
/// @dev Plain English: an issuer writes "I committed to this 32-byte
///      fingerprint under this schema" and the chain records the block it
///      happened in. Nothing private goes on chain: no receipt, no customer,
///      no amount. The contract holds no funds, has no owner, no upgrade
///      path, no external calls, and no way to edit or delete a record.
///
///      Commitment identity is (issuer, digest). The same issuer cannot
///      commit the same digest twice. Different issuers are independent, so
///      finding a digest under an unexpected issuer proves nothing
///      (PRODUCT_ARCHITECTURE.md §12.10, SECURITY_PRINCIPLES.md §21).
contract EvidenceAnchor {
    /// @notice A digest of zero is never a valid receipt digest.
    error ZeroDigest();
    /// @notice A schema identifier of zero is never valid.
    error ZeroSchemaId();
    /// @notice This issuer already committed this digest.
    error AlreadyCommitted(address issuer, bytes32 digest);

    /// @notice Emitted once per (issuer, digest). Contains only public values.
    event EvidenceCommitted(address indexed issuer, bytes32 indexed digest, bytes32 indexed schemaId);

    /// @dev issuer => digest => block number of the commitment (0 = none).
    mapping(address issuer => mapping(bytes32 digest => uint256 blockNumber)) private _committedAt;

    /// @notice Commit a receipt digest under a schema identifier.
    /// @param digest SHA-256 of the canonical receipt core, as bytes32.
    /// @param schemaId SHA-256 of "<schema>@<version>", as bytes32.
    function commit(bytes32 digest, bytes32 schemaId) external {
        if (digest == bytes32(0)) revert ZeroDigest();
        if (schemaId == bytes32(0)) revert ZeroSchemaId();
        if (_committedAt[msg.sender][digest] != 0) revert AlreadyCommitted(msg.sender, digest);
        _committedAt[msg.sender][digest] = block.number;
        emit EvidenceCommitted(msg.sender, digest, schemaId);
    }

    /// @notice Block number in which `issuer` committed `digest`, or 0 if never.
    function committedAtBlock(address issuer, bytes32 digest) external view returns (uint256) {
        return _committedAt[issuer][digest];
    }
}
