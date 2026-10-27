import { OracleRoll } from "../domain/types";

const TWISTS = [
  "代价比预想更具体，立刻写进场景压力。",
  "一个无关 NPC 突然变得重要。",
  "阵营时钟推进一格。",
  "线索是真的，但来源有私心。",
  "现场出现第三方目击者。",
  "资源、时间或声望必须牺牲一个。",
  "敌人误判了你，但不是以你希望的方式。",
  "下一个行动会暴露你的身份或位置。",
];

export function oracleAnswer(question: string, odds: OracleRoll["odds"]): OracleRoll {
  const die = Math.floor(Math.random() * 10) + 1;
  const thresholds = {
    unlikely: [1, 2, 4, 6, 8],
    even: [1, 3, 5, 7, 9],
    likely: [1, 4, 6, 8, 9],
  }[odds];

  let answer: OracleRoll["answer"];
  if (die <= thresholds[0]) answer = "no-and";
  else if (die <= thresholds[1]) answer = "no";
  else if (die <= thresholds[2]) answer = "no-but";
  else if (die <= thresholds[3]) answer = "yes-but";
  else if (die <= thresholds[4]) answer = "yes";
  else answer = "yes-and";

  return {
    id: crypto.randomUUID(),
    question,
    odds,
    die,
    answer,
    twist: die === 1 || die === 10 ? TWISTS[Math.floor(Math.random() * TWISTS.length)] : undefined,
    createdAt: new Date().toISOString(),
  };
}

export function answerLabel(answer: OracleRoll["answer"]): string {
  const labels: Record<OracleRoll["answer"], string> = {
    "no-and": "否，而且",
    no: "否",
    "no-but": "否，但是",
    "yes-but": "是，但是",
    yes: "是",
    "yes-and": "是，而且",
  };
  return labels[answer];
}
