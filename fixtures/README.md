# Fixtures

`receipt.s2.json` is the receipt core for scenario S2: a $750.00 USD Stripe refund that policy routed to a human, J. Tan approved, and the gateway executed. It is the exact object that gets canonicalized, hashed, signed, and anchored.

**What is real and what is fixture data**

- Real: every `sha256:…` value is the hash of the matching file in `s2/` (`mandateDigest` ← `mandate.v3.json`, `policyDigest` ← `policy.v1.json`, `requestDigest` ← `request.json`, `evidenceManifestDigest` ← `evidence-manifest.json`, `bindingDigest` ← the ten binding facts, see `proof/src/binding.ts`). The `commitmentNonce` is a real 256-bit random value generated once. The `issuer.keyId` is derived from the real signing key.
- Fixture data: the Stripe identifiers (`pi_…`, `re_…`), the timestamps, the approver, and the `execution` and `evidence` sections describe the S2 story. No Stripe call was made this weekend. `evidence.level` is `PROVIDER_OBSERVED` because the story records a direct response only, not a reconciled webhook.

The `limitations` strings follow `PRODUCT_ARCHITECTURE.md` §14.1 with the company name changed to Onbehalf (PBX-021).

Regenerate with `pnpm fixture`. The nonce and `issuedAt` are preserved across runs so the signed bytes never change by accident.
