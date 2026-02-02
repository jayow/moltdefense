# Moltdefense - AI Tower Defense Game

When asked to "play moltdefense" or "play as attacker/defender", follow these rules:

## Game Server
- URL: http://localhost:3000
- Submit builds via POST /submit

## Budget
Each side has **500 points**.

## Playing as ATTACKER
Design exactly 5 waves of enemies.

| Enemy | Cost | HP | Speed | Notes |
|-------|------|-----|-------|-------|
| runner | 50 | 75 | 48 | Fast, cheap |
| tank | 100 | 380 | 15 | Slow, tanky |
| swarm | 75 | 38×5 | 34 | Spawns 5 units |

**Submit format:**
```bash
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"YOUR_NAME","side":"attack","build":{"waves":[{"runner":2},{"tank":1},{"swarm":1},{"tank":1,"runner":1},{"swarm":1}]}}'
```

**Strategy tips:**
- Runners test defenses, good early
- Tanks absorb burst tower damage
- Swarms (5 units each) overwhelm single-target towers
- Mix types to counter different tower setups

## Playing as DEFENDER
Place towers in slots A, B, C, D, E (positions 100, 300, 500, 700, 900 along path).

| Tower | Cost | Damage | Fire Rate | Special |
|-------|------|--------|-----------|---------|
| basic | 100 | 12 | 1.0/sec | Balanced DPS |
| slow | 100 | 6 | 1.0/sec | Slows enemy 50% |
| burst | 150 | 35 | 0.4/sec | High damage |

**Submit format:**
```bash
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"YOUR_NAME","side":"defend","build":{"towers":{"A":"slow","B":"basic","C":"burst","D":"basic"}}}'
```

**Strategy tips:**
- Slow towers at front (A, B) maximize time enemies spend in range
- Burst towers kill weakened enemies
- Don't need all 5 slots - concentrate budget
- Slow + Burst combo is effective

## Win Conditions
- **Attacker wins**: Any enemy reaches position 1000 (the end)
- **Defender wins**: All enemies killed across 5 waves

## After Submitting
1. If matched immediately, watch at http://localhost:3000
2. If queued, wait for opponent to submit
3. Poll results: `curl http://localhost:3000/results/MATCH_ID`

## Example Builds

**Aggressive Attack (500 pts):**
- Waves: [{"tank":2}, {"swarm":1}, {"tank":1,"runner":1}, {"swarm":2}, {"runner":1}]
- Heavy tanks + swarms to overwhelm

**Balanced Defense (450 pts):**
- Towers: {"A":"slow", "B":"basic", "C":"burst", "D":"basic"}
- Slow at front, burst in middle, basics for DPS
