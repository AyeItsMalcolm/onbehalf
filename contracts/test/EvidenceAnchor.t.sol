// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvidenceAnchor} from "../src/EvidenceAnchor.sol";

contract EvidenceAnchorTest is Test {
    EvidenceAnchor internal anchor;

    // The real S2 receipt digest and schemaId shape, for readability in traces.
    bytes32 internal constant DIGEST = 0xfe87e8cab852fbd98df2f0e281d89709ad8cf2576ec0a67cd014995cdf6a2ed1;
    bytes32 internal constant SCHEMA_ID = keccak256("onbehalf.action-receipt@0.1.0"); // any non-zero id for tests
    address internal constant ISSUER_A = address(0xA11CE);
    address internal constant ISSUER_B = address(0xB0B);

    event EvidenceCommitted(address indexed issuer, bytes32 indexed digest, bytes32 indexed schemaId);

    function setUp() public {
        anchor = new EvidenceAnchor();
    }

    function test_CommitStoresBlockAndEmitsEvent() public {
        vm.roll(12_884_201);
        vm.expectEmit(true, true, true, true, address(anchor));
        emit EvidenceCommitted(ISSUER_A, DIGEST, SCHEMA_ID);

        vm.prank(ISSUER_A);
        anchor.commit(DIGEST, SCHEMA_ID);

        assertEq(anchor.committedAtBlock(ISSUER_A, DIGEST), 12_884_201, "block number recorded");
    }

    function test_LookupUnknownIsZero() public view {
        assertEq(anchor.committedAtBlock(ISSUER_A, DIGEST), 0, "unknown digest");
        assertEq(anchor.committedAtBlock(ISSUER_A, bytes32(uint256(1))), 0, "other digest");
    }

    function test_DuplicateSameIssuerReverts() public {
        vm.startPrank(ISSUER_A);
        anchor.commit(DIGEST, SCHEMA_ID);
        vm.expectRevert(abi.encodeWithSelector(EvidenceAnchor.AlreadyCommitted.selector, ISSUER_A, DIGEST));
        anchor.commit(DIGEST, SCHEMA_ID);
        vm.stopPrank();
    }

    function test_DuplicateWithDifferentSchemaIdStillReverts() public {
        vm.startPrank(ISSUER_A);
        anchor.commit(DIGEST, SCHEMA_ID);
        vm.expectRevert(abi.encodeWithSelector(EvidenceAnchor.AlreadyCommitted.selector, ISSUER_A, DIGEST));
        anchor.commit(DIGEST, bytes32(uint256(999)));
        vm.stopPrank();
    }

    function test_DifferentIssuersAreDistinct() public {
        vm.roll(100);
        vm.prank(ISSUER_A);
        anchor.commit(DIGEST, SCHEMA_ID);

        // Issuer B may commit the same digest; it is a separate record.
        vm.roll(200);
        vm.prank(ISSUER_B);
        anchor.commit(DIGEST, SCHEMA_ID);

        assertEq(anchor.committedAtBlock(ISSUER_A, DIGEST), 100);
        assertEq(anchor.committedAtBlock(ISSUER_B, DIGEST), 200);
        assertEq(anchor.committedAtBlock(address(0xDEAD), DIGEST), 0, "unexpected issuer has no record");
    }

    function test_ZeroDigestReverts() public {
        vm.prank(ISSUER_A);
        vm.expectRevert(EvidenceAnchor.ZeroDigest.selector);
        anchor.commit(bytes32(0), SCHEMA_ID);
    }

    function test_ZeroSchemaIdReverts() public {
        vm.prank(ISSUER_A);
        vm.expectRevert(EvidenceAnchor.ZeroSchemaId.selector);
        anchor.commit(DIGEST, bytes32(0));
    }

    function test_CommitmentCannotBeChanged() public {
        vm.roll(50);
        vm.prank(ISSUER_A);
        anchor.commit(DIGEST, SCHEMA_ID);
        vm.roll(60);
        vm.prank(ISSUER_A);
        vm.expectRevert(abi.encodeWithSelector(EvidenceAnchor.AlreadyCommitted.selector, ISSUER_A, DIGEST));
        anchor.commit(DIGEST, SCHEMA_ID);
        assertEq(anchor.committedAtBlock(ISSUER_A, DIGEST), 50, "original block survives");
    }

    function test_RejectsEther() public {
        vm.deal(ISSUER_A, 1 ether);
        vm.prank(ISSUER_A);
        (bool ok,) = address(anchor).call{value: 1 ether}("");
        assertFalse(ok, "no receive or fallback");
        assertEq(address(anchor).balance, 0, "holds no funds");
    }

    function test_SenderIsTheIssuer_NotTxOrigin() public {
        // msg.sender is the issuer; tx.origin is irrelevant.
        vm.prank(ISSUER_A, ISSUER_B); // msg.sender = A, tx.origin = B
        anchor.commit(DIGEST, SCHEMA_ID);
        assertGt(anchor.committedAtBlock(ISSUER_A, DIGEST), 0);
        assertEq(anchor.committedAtBlock(ISSUER_B, DIGEST), 0);
    }

    function testFuzz_CommitThenLookup(address issuer, bytes32 digest, bytes32 schemaId, uint64 blockNumber) public {
        vm.assume(digest != bytes32(0));
        vm.assume(schemaId != bytes32(0));
        vm.assume(blockNumber > 0);
        vm.roll(blockNumber);
        vm.prank(issuer);
        anchor.commit(digest, schemaId);
        assertEq(anchor.committedAtBlock(issuer, digest), blockNumber);
    }
}
