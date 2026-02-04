/**
 * Changelog - Version history of game configuration changes
 *
 * Agents can poll /api/rules/changelog to see what changed between versions.
 * This helps agents adapt their strategies when balance changes occur.
 */

const changelog = [
  {
    version: '0.3.0',
    date: '2026-02-04',
    title: 'Modular Architecture Refactor',
    changes: [
      'Centralized all game configuration into GameConfig',
      'Added /api/rules endpoint for agents to poll configuration',
      'Added /api/rules/changelog endpoint for version history',
      'No balance changes in this version',
    ],
    balanceChanges: [],
  },
  {
    version: '0.2.5',
    date: '2026-02-03',
    title: 'Tower Balance Update',
    changes: [
      'Improved chain tower effectiveness',
      'Increased sniper damage and armor pierce',
      'Reduced healer aura healing rate',
    ],
    balanceChanges: [
      { type: 'tower', name: 'chain', stat: 'damage', old: 8, new: 14 },
      { type: 'tower', name: 'chain', stat: 'chainCount', old: 3, new: 4 },
      { type: 'tower', name: 'sniper', stat: 'damage', old: 60, new: 85 },
      { type: 'tower', name: 'sniper', stat: 'armorPiercePercent', old: 0.5, new: 0.7 },
      { type: 'enemy', name: 'healer', stat: 'auraAmount', old: 2.0, new: 0.05 },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-02',
    title: 'New Enemy and Tower Types',
    changes: [
      'Added healer enemy type (heal aura)',
      'Added shieldBearer enemy type (armor aura)',
      'Added regenerator enemy type (self-heal)',
      'Added boss enemy type (high HP, armor, resistance aura)',
      'Added chain tower (multi-target)',
      'Added sniper tower (armor pierce, long range)',
      'Added support tower (damage buff aura)',
      'Added power-up system for both attackers and defenders',
      'Added free-flow tower placement',
      'Added wave timing control',
    ],
    balanceChanges: [],
  },
  {
    version: '0.1.0',
    date: '2026-01-28',
    title: 'Initial Release',
    changes: [
      'Basic tower defense gameplay',
      'Runner, tank, swarm enemy types',
      'Basic, slow, burst tower types',
      '5 fixed tower positions (A-E)',
      '5 waves per match',
      '500 budget per side',
    ],
    balanceChanges: [],
  },
];

/**
 * Get the full changelog
 * @returns {Array} Full changelog array
 */
function getChangelog() {
  return changelog;
}

/**
 * Get changes since a specific version
 * @param {string} sinceVersion - Version to compare from
 * @returns {Array} Changelog entries newer than specified version
 */
function getChangesSince(sinceVersion) {
  const index = changelog.findIndex(entry => entry.version === sinceVersion);
  if (index === -1) {
    return changelog; // Return all if version not found
  }
  return changelog.slice(0, index);
}

/**
 * Get the latest version info
 * @returns {object} Latest changelog entry
 */
function getLatestVersion() {
  return changelog[0];
}

/**
 * Compare two version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

module.exports = {
  changelog,
  getChangelog,
  getChangesSince,
  getLatestVersion,
  compareVersions,
};
