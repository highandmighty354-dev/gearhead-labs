#!/usr/bin/env node
/* Test fixture for premium/tests/proof/red-green-harness.test.js: a self-test stand-in that prints a perfect SELFTEST_JSON summary and then exits 1. */
'use strict';
console.log('SELFTEST_JSON ' + JSON.stringify({ total: 10, passed: 10, failed: 0, failures: [], pageErrors: [] }));
console.error('simulated crash after printing the summary');
process.exit(1);
