import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankCharacter, deriveHp, rollRedCheck } from ".";

describe("cyberpunk red rules adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives hp from BODY and WILL", () => {
    const character = createBlankCharacter();
    expect(character.stats.body).toBe(5);
    expect(character.stats.will).toBe(5);
    expect(character.hp.max).toBe(35);
    expect(deriveHp({ ...character.stats, body: 8, will: 6 }).max).toBe(45);
  });

  it("requires beating the dv", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const result = rollRedCheck({ stat: 5, skill: 4, modifier: 0, dv: 13 });
    expect(result.firstDie).toBe(5);
    expect(result.total).toBe(14);
    expect(result.success).toBe(true);
    expect(result.margin).toBe(1);
  });

  it("handles critical success extra die", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99).mockReturnValueOnce(0.3);
    const result = rollRedCheck({ stat: 5, skill: 4, dv: 20 });
    expect(result.firstDie).toBe(10);
    expect(result.extraDie).toBe(4);
    expect(result.critical).toBe("success");
    expect(result.total).toBe(23);
  });

  it('fails when the total equals DV and does not treat rolling 10 as automatic success',()=>{
    vi.spyOn(Math,'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    expect(rollRedCheck({stat:5,skill:4,dv:13}).success).toBe(false);
    expect(rollRedCheck({stat:2,skill:0,dv:29}).success).toBe(false);
  });

  it("handles critical failure penalty die", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.4);
    const result = rollRedCheck({ stat: 5, skill: 4, dv: 13 });
    expect(result.firstDie).toBe(1);
    expect(result.extraDie).toBe(5);
    expect(result.critical).toBe("failure");
    expect(result.total).toBe(5);
  });
  it('uses the original 1 without subtracting another die when Fumble Recovery applies',()=>{
    const random=vi.spyOn(Math,'random').mockReturnValue(0);
    expect(rollRedCheck({stat:6,skill:6,dv:13,ignoreCriticalFailure:true})).toMatchObject({firstDie:1,total:13,critical:'none',success:false});
    expect(random).toHaveBeenCalledTimes(1);
  });
});
