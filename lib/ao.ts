/**
 * AO connection singleton.
 * Re-exports from the centralized ao-config for backward compatibility.
 */
export { getAO as ao } from './ao-config';
export { aoConnect as connect } from './ao-config';
export { getAOConfig, PROCESS_IDS, FEATURES, createDataItemSigner } from './ao-config';
