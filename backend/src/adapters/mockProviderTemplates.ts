import { chooseByText, type Theme } from './mockProviderRules.js';

export function empathyOptions(theme: Theme, focus: string): string[] {
  const options: Record<Theme, string[]> = {
    anxiety: [
      `긴장이 계속 올라오는 상태처럼 들려요. ${focus} 때문에 몸이 먼저 놀라고 있을 수도 있어요.`,
      `불안이 커지면 생각이 빨라져서 더 벅차지죠. ${focus}에서 그런 반응이 나오는 건 자연스러워요.`,
      `${focus}를 다루는 동안 마음이 급해지는 게 느껴져요. 지금은 속도를 낮춰도 괜찮아요.`
    ],
    fatigue: [
      `많이 지친 톤이 느껴져요. ${focus}를 견디는 데 에너지가 많이 빠진 것 같아요.`,
      '에너지가 바닥난 느낌이 전해져요. 여기서는 속도를 천천히 해도 괜찮아요.',
      `${focus}를 붙잡고 있었던 시간 자체가 길었을 수 있어요. 지금은 버티는 기준으로 볼게요.`
    ],
    focus: [
      `집중이 풀리는 느낌이 계속되면 ${focus} 자체가 더 버겁게 느껴질 수 있어요.`,
      `${focus} 앞에서 머리가 자꾸 흩어지는 상태 같아요. 의지가 약해서라기보다 피로가 쌓였을 때 자주 그래요.`,
      `${focus}에 바로 몰입이 안 되는 게 이상한 건 아니에요. 지금은 진입 장벽을 낮추는 쪽이 더 현실적이에요.`
    ],
    lonely: [
      `혼자 버티는 느낌이 큰 것 같아요. ${focus} 같은 이야기는 더 꺼내기 어렵죠.`,
      '고립감이 느껴질 때는 작은 반응조차 큰 힘이 되기도 해요. 여기서는 혼자가 아니에요.',
      `${focus}를 혼자 감당하고 있었다면 지금 말 꺼낸 것만으로도 큰 변화예요.`
    ],
    self_blame: [
      `자책이 크게 올라오는 상황처럼 들려요. ${focus}를 전부 내 탓으로 묶고 싶어졌을 수 있어요.`,
      '내 탓으로 묶고 싶은 마음이 보이는데, 지금은 판단보다 숨 돌리는 게 먼저일 수 있어요.',
      `${focus}를 떠올릴수록 스스로를 몰아붙이게 되는 패턴이 보이네요. 지금은 강도를 낮춰볼게요.`
    ],
    generic: [
      `지금 느끼는 무게를 이렇게 바로 말해줘서 고마워요. ${focus}부터 차근히 볼게요.`,
      `${focus} 때문에 머리가 복잡해진 상태로 들려요. 지금은 핵심 하나만 붙잡아도 충분해요.`,
      `${focus}를 다루는 방식은 사람마다 달라요. 네 리듬에 맞춰서 이어가보자.`
    ]
  };
  return options[theme];
}

export function highLoadLinePool(text: string, selectedEmpathy: string): string[] {
  return [
    selectedEmpathy,
    chooseByText(text + 'h1', ['지금은 정리보다 버티는 쪽이 더 맞아 보여요.', '길게 설명하지 않아도 흐름은 충분히 느껴져요.']),
    chooseByText(text + 'h2', ['내가 너무 앞서가지 않게 속도를 맞출게요.', '당장 결론을 붙이지 않아도 돼요. 지금은 맥락을 먼저 볼게요.']),
    chooseByText(text + 'h3', ['지금 가장 걸리는 장면 하나만 집어줘도 충분해요.', '제일 먼저 건드려진 부분부터 같이 보죠.']),
    chooseByText(text + 'h4', ['숨을 크게 바꾸기 어렵다면, 그냥 멈춰 있는 상태여도 괜찮아요.', '지금은 잘 정리하는 것보다 덜 흔들리는 쪽이 더 중요해 보여요.']),
    chooseByText(text + 'h5', ['내가 먼저 서두르지 않을게요. 이어서 말하고 싶으면 그때 붙이면 돼요.', '짧게 이어도 되고, 잠깐 멈춰도 돼요. 흐름만 같이 잡아볼게요.'])
  ];
}

export function questionLines(text: string, selectedEmpathy: string): string[] {
  return [
    selectedEmpathy,
    chooseByText(text + 'q', ['답을 넓게 하기보다, 지금 제일 무거운 포인트 하나부터 짚어볼까요?', '해결책을 많이 찾기보다, 지금 가장 버거운 한 장면부터 같이 보죠.'])
  ];
}

export function baseLines(text: string, selectedEmpathy: string): string[] {
  return [
    selectedEmpathy,
    chooseByText(text + 'g1', ['말을 이어가고 싶으면 계속 적어도 되고, 잠깐 멈춰도 괜찮아요.', '내가 앞서 해석하지 않도록, 한 번에 하나씩 볼게요.']),
    chooseByText(text + 'g2', ['지금은 해답보다 상황을 정확히 듣는 쪽이 먼저예요.', '필요하면 이 대화를 짧은 단위로 나눠서 이어가도 좋아요.'])
  ];
}
