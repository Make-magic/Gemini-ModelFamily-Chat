
import { succinctScenario, socraticScenario, Gemini3Scenario, defaultScenario, reasonerScenario } from './scenarios/utility';
import { voxelScenario, StandardPromptScenario } from './scenarios/demo';

// Re-export all scenarios
export * from './scenarios/jailbreak';
export * from './scenarios/utility';
export * from './scenarios/demo';

export const SYSTEM_SCENARIO_IDS = [
    // FOP, Unrestricted, Pyrite, and Anna have been moved to user scenarios via seeding
    succinctScenario.id,
    socraticScenario.id,
    Gemini3Scenario.id,
    defaultScenario.id,
    reasonerScenario.id,
    voxelScenario.id,
    StandardPromptScenario.id
];
