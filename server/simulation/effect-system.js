/**
 * Effect System - Pluggable system for buffs, debuffs, and upgrades
 *
 * Enables mid-match modifications to entities:
 * - Temporary buffs (speed boost, damage boost)
 * - Debuffs (slow, freeze)
 * - Persistent modifiers (upgrades)
 * - Power-up effects
 *
 * Effects are tracked per-entity and processed each tick.
 */

/**
 * Effect types
 */
const EFFECT_TYPES = {
  // Speed modifiers
  SPEED_BOOST: 'speedBoost',
  SLOW: 'slow',
  FREEZE: 'freeze',

  // Damage modifiers
  DAMAGE_BOOST: 'damageBoost',
  ARMOR_BUFF: 'armorBuff',
  DAMAGE_REDUCTION: 'damageReduction',

  // Special states
  SHIELD: 'shield',
  INVISIBILITY: 'invisibility',
  REGENERATION: 'regeneration',

  // Aura effects (applied from other entities)
  HEAL_AURA: 'healAura',
  ARMOR_AURA: 'armorAura',
  RESISTANCE_AURA: 'resistanceAura',
};

/**
 * EffectSystem class - manages all active effects
 */
class EffectSystem {
  constructor() {
    // Map of entityId -> array of active effects
    this.activeEffects = new Map();

    // Statistics for debugging
    this.stats = {
      effectsApplied: 0,
      effectsExpired: 0,
    };
  }

  /**
   * Reset the effect system (call between matches)
   */
  reset() {
    this.activeEffects.clear();
    this.stats = {
      effectsApplied: 0,
      effectsExpired: 0,
    };
  }

  /**
   * Apply an effect to an entity
   * @param {string} entityId - Entity ID
   * @param {object} effect - Effect configuration
   * @returns {object} The applied effect
   */
  applyEffect(entityId, effect) {
    if (!this.activeEffects.has(entityId)) {
      this.activeEffects.set(entityId, []);
    }

    const appliedEffect = {
      id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: effect.type,
      stat: effect.stat || null,
      modifier: effect.modifier || 1.0,
      duration: effect.duration || 0, // 0 = permanent
      ticksRemaining: effect.duration || Infinity,
      stacks: effect.stacks !== false, // Can this effect stack?
      source: effect.source || null, // Who/what applied this effect
      data: effect.data || {}, // Additional effect-specific data
      appliedAt: Date.now(),
    };

    const effects = this.activeEffects.get(entityId);

    // If effect doesn't stack, remove existing effects of same type
    if (!appliedEffect.stacks) {
      const existing = effects.findIndex(e => e.type === appliedEffect.type);
      if (existing !== -1) {
        effects.splice(existing, 1);
      }
    }

    effects.push(appliedEffect);
    this.stats.effectsApplied++;

    return appliedEffect;
  }

  /**
   * Remove a specific effect from an entity
   * @param {string} entityId - Entity ID
   * @param {string} effectId - Effect ID to remove
   * @returns {boolean} Whether the effect was removed
   */
  removeEffect(entityId, effectId) {
    const effects = this.activeEffects.get(entityId);
    if (!effects) return false;

    const index = effects.findIndex(e => e.id === effectId);
    if (index !== -1) {
      effects.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove all effects of a specific type from an entity
   * @param {string} entityId - Entity ID
   * @param {string} effectType - Effect type to remove
   * @returns {number} Number of effects removed
   */
  removeEffectsByType(entityId, effectType) {
    const effects = this.activeEffects.get(entityId);
    if (!effects) return 0;

    const initialLength = effects.length;
    const remaining = effects.filter(e => e.type !== effectType);
    this.activeEffects.set(entityId, remaining);

    return initialLength - remaining.length;
  }

  /**
   * Remove all effects from an entity
   * @param {string} entityId - Entity ID
   */
  clearEffects(entityId) {
    this.activeEffects.delete(entityId);
  }

  /**
   * Get all active effects for an entity
   * @param {string} entityId - Entity ID
   * @returns {object[]} Array of active effects
   */
  getEffects(entityId) {
    return this.activeEffects.get(entityId) || [];
  }

  /**
   * Check if an entity has a specific effect type
   * @param {string} entityId - Entity ID
   * @param {string} effectType - Effect type to check
   * @returns {boolean}
   */
  hasEffect(entityId, effectType) {
    const effects = this.activeEffects.get(entityId) || [];
    return effects.some(e => e.type === effectType);
  }

  /**
   * Get the combined modifier for a specific stat
   * @param {string} entityId - Entity ID
   * @param {string} stat - Stat name (speed, damage, armor, etc.)
   * @returns {number} Combined modifier (multiply with base stat)
   */
  getModifier(entityId, stat) {
    const effects = this.activeEffects.get(entityId) || [];
    let modifier = 1.0;

    for (const effect of effects) {
      if (effect.stat === stat && effect.modifier !== null) {
        modifier *= effect.modifier;
      }
    }

    return modifier;
  }

  /**
   * Get the flat bonus for a specific stat (additive effects)
   * @param {string} entityId - Entity ID
   * @param {string} stat - Stat name
   * @returns {number} Flat bonus to add to base stat
   */
  getFlatBonus(entityId, stat) {
    const effects = this.activeEffects.get(entityId) || [];
    let bonus = 0;

    for (const effect of effects) {
      if (effect.stat === stat && effect.data.flatBonus) {
        bonus += effect.data.flatBonus;
      }
    }

    return bonus;
  }

  /**
   * Process one game tick - decrements durations and removes expired effects
   * @returns {object[]} Array of expired effects (for event generation)
   */
  tick() {
    const expiredEffects = [];

    for (const [entityId, effects] of this.activeEffects) {
      const remaining = [];

      for (const effect of effects) {
        if (effect.ticksRemaining !== Infinity) {
          effect.ticksRemaining--;
        }

        if (effect.ticksRemaining > 0) {
          remaining.push(effect);
        } else {
          expiredEffects.push({ entityId, effect });
          this.stats.effectsExpired++;
        }
      }

      if (remaining.length === 0) {
        this.activeEffects.delete(entityId);
      } else {
        this.activeEffects.set(entityId, remaining);
      }
    }

    return expiredEffects;
  }

  /**
   * Calculate effective speed for an enemy
   * Accounts for slow, freeze, and speed boost effects
   * @param {object} enemy - Enemy entity
   * @returns {number} Effective speed
   */
  getEffectiveSpeed(enemy) {
    // Check for freeze effect first
    if (this.hasEffect(enemy.id, EFFECT_TYPES.FREEZE)) {
      return 0;
    }

    let speed = enemy.speed * enemy.speedMultiplier;

    // Apply speed modifiers
    speed *= this.getModifier(enemy.id, 'speed');

    return Math.max(0, speed);
  }

  /**
   * Calculate effective damage for a tower
   * @param {object} tower - Tower entity
   * @returns {number} Effective damage
   */
  getEffectiveDamage(tower) {
    let damage = tower.damage;

    // Apply damage modifiers
    damage *= this.getModifier(tower.id, 'damage');

    // Apply flat bonuses
    damage += this.getFlatBonus(tower.id, 'damage');

    return Math.max(0, damage);
  }

  /**
   * Calculate effective armor for an enemy
   * @param {object} enemy - Enemy entity
   * @returns {number} Effective armor
   */
  getEffectiveArmor(enemy) {
    let armor = enemy.armor || 0;

    // Apply armor modifiers
    armor *= this.getModifier(enemy.id, 'armor');

    // Apply flat bonuses (from auras, etc.)
    armor += this.getFlatBonus(enemy.id, 'armor');

    return Math.max(0, armor);
  }

  /**
   * Check if an enemy is targetable (not invisible)
   * @param {object} enemy - Enemy entity
   * @returns {boolean}
   */
  isTargetable(enemy) {
    return !this.hasEffect(enemy.id, EFFECT_TYPES.INVISIBILITY);
  }

  /**
   * Get shield HP remaining for an enemy
   * @param {object} enemy - Enemy entity
   * @returns {number} Shield HP remaining (0 if no shield)
   */
  getShieldHp(enemy) {
    const effects = this.getEffects(enemy.id);
    const shieldEffect = effects.find(e => e.type === EFFECT_TYPES.SHIELD);
    return shieldEffect ? (shieldEffect.data.shieldHp || 0) : 0;
  }

  /**
   * Apply damage to an enemy, accounting for shield and armor
   * @param {object} enemy - Enemy entity
   * @param {number} damage - Raw damage amount
   * @param {object} options - Options like armor pierce percentage
   * @returns {object} { actualDamage, shieldAbsorbed, blocked }
   */
  applyDamage(enemy, damage, options = {}) {
    const effects = this.getEffects(enemy.id);
    let remaining = damage;
    let shieldAbsorbed = 0;

    // Apply damage reduction first
    const damageReduction = 1 - this.getModifier(enemy.id, 'damageReduction');
    if (damageReduction > 0) {
      remaining *= (1 - damageReduction);
    }

    // Check for shield effect
    const shieldEffect = effects.find(e => e.type === EFFECT_TYPES.SHIELD);
    if (shieldEffect && shieldEffect.data.shieldHp > 0) {
      const absorbed = Math.min(remaining, shieldEffect.data.shieldHp);
      shieldEffect.data.shieldHp -= absorbed;
      remaining -= absorbed;
      shieldAbsorbed = absorbed;

      // Remove shield if depleted
      if (shieldEffect.data.shieldHp <= 0) {
        this.removeEffect(enemy.id, shieldEffect.id);
      }
    }

    // Apply armor
    const armor = this.getEffectiveArmor(enemy);
    const armorPierce = options.armorPiercePercent || 0;
    const effectiveArmor = armor * (1 - armorPierce);
    const blocked = Math.min(remaining - 1, effectiveArmor); // Always at least 1 damage
    remaining = Math.max(1, remaining - blocked);

    return {
      actualDamage: remaining,
      shieldAbsorbed,
      blocked,
    };
  }

  /**
   * Get statistics about the effect system
   * @returns {object}
   */
  getStats() {
    let totalActiveEffects = 0;
    for (const effects of this.activeEffects.values()) {
      totalActiveEffects += effects.length;
    }

    return {
      ...this.stats,
      entitiesWithEffects: this.activeEffects.size,
      totalActiveEffects,
    };
  }
}

// Create and export singleton instance
const effectSystem = new EffectSystem();

module.exports = {
  EffectSystem,
  effectSystem,
  EFFECT_TYPES,
};
