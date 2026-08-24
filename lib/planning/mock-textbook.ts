import type { TextbookUnit } from "./types";

// 실제 교과서 DB가 준비되면 동일한 TextbookUnit 형태의 API 응답으로 교체한다.
export const TEMP_TEXTBOOK_UNITS: TextbookUnit[] = [
  {
    id: "prime-factorization",
    order: 1,
    title: "소인수분해",
    pageFrom: 10,
    pageTo: 35,
    estimatedMinutes: 150,
    concepts: ["소수와 합성수", "소인수분해", "최대공약수와 최소공배수"],
  },
  {
    id: "integers-rationals",
    order: 2,
    title: "정수와 유리수",
    pageFrom: 36,
    pageTo: 73,
    estimatedMinutes: 210,
    concepts: ["정수와 유리수", "수의 대소 관계", "정수와 유리수의 계산"],
  },
  {
    id: "expressions",
    order: 3,
    title: "문자와 식",
    pageFrom: 74,
    pageTo: 107,
    estimatedMinutes: 200,
    concepts: ["문자의 사용", "일차식의 계산", "방정식의 뜻과 풀이"],
  },
  {
    id: "coordinates-graphs",
    order: 4,
    title: "좌표평면과 그래프",
    pageFrom: 108,
    pageTo: 139,
    estimatedMinutes: 180,
    concepts: ["순서쌍과 좌표", "그래프", "정비례와 반비례"],
  },
  {
    id: "basic-geometry",
    order: 5,
    title: "기본 도형",
    pageFrom: 140,
    pageTo: 179,
    estimatedMinutes: 220,
    concepts: ["점·선·면", "각", "위치 관계", "작도와 합동"],
  },
];
