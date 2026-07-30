function parseMafiaMeta(body: string) {
  const normalized = body.replace(/^\[([A-Z_]+)_\s+/, '[$1] ');
  const get = (key: string) => {
    const match = new RegExp(`${key}=([^\\s\\]]+)`).exec(normalized);
    return match ? decodeURIComponent(match[1]) : undefined;
  };
  return { normalized, get };
}

export function displayMafiaSystemText(body: string) {
  if (!body.startsWith('[MAFIA_')) return body;

  const { normalized, get } = parseMafiaMeta(body);
  const name = get('name') ?? get('user') ?? undefined;
  const targetName = get('targetName') ?? name;

  if (normalized.startsWith('[MAFIA_CANCELLED')) {
    return '참여 인원이 부족하여 마피아 게임이 취소되었습니다';
  }
  if (normalized.startsWith('[MAFIA_EXECUTION_REJECTED')) {
    return '찬성이 과반을 넘지 않아 아무도 처형되지 않았습니다';
  }
  if (normalized.startsWith('[MAFIA_NIGHT_SAVED')) {
    return `${targetName ?? '대상'}님이 마피아에게 총을 맞았지만, 의사의 도움으로 살아났습니다`;
  }
  if (normalized.startsWith('[MAFIA_NIGHT_KILL')) {
    return `${targetName ?? '대상'}님이 마피아의 총에 맞아 사망했습니다`;
  }
  if (normalized.startsWith('[MAFIA_FORCE_ENDED')) {
    return `${name ?? '진행자'}님이 게임을 강제 종료하였습니다`;
  }
  if (normalized.startsWith('[MAFIA_LOBBY')) {
    return '마피아 게임에 참여하시겠습니까? 1분 후 시작합니다';
  }
  if (normalized.startsWith('[MAFIA_CANCEL_JOIN')) {
    return `${name ?? '멤버'}님이 마피아 게임 참여를 취소했습니다`;
  }
  if (normalized.startsWith('[MAFIA_DAY_START')) {
    return `${get('day') ?? '1'}일 차 낮이 되었습니다`;
  }
  if (normalized.startsWith('[MAFIA_DAY_VOTE_START')) {
    return '투표를 시작합니다';
  }
  if (normalized.startsWith('[MAFIA_NO_EXECUTION')) {
    return '투표 결과 처형 없이 밤이 되었습니다';
  }
  if (normalized.startsWith('[MAFIA_FINAL_DEFENSE')) {
    return `${name ?? '대상'}님이 최후의 반론을 시작합니다`;
  }
  if (normalized.startsWith('[MAFIA_FINAL_VOTE_START')) {
    return '찬반 투표를 시작합니다';
  }
  if (normalized.startsWith('[MAFIA_EXECUTED')) {
    const role = get('role');
    return `${name ?? '대상'}님이 사망하셨습니다. ${name ?? '대상'}님은 ${
      role === 'mafia' ? '마피아였습니다' : '마피아가 아니었습니다'
    }`;
  }
  if (normalized.startsWith('[MAFIA_NIGHT_START')) {
    return `${get('day') ?? '1'}일 차 밤이 되었습니다`;
  }
  if (normalized.startsWith('[MAFIA_NIGHT_NO_DEATH')) {
    return '밤사이 아무도 사망하지 않았습니다';
  }
  if (normalized.startsWith('[MAFIA_GAME_END')) {
    return get('winner') === 'mafia' ? '마피아팀이 승리하였습니다' : '시민팀이 승리하였습니다';
  }
  if (normalized.startsWith('[MAFIA_INSPECT_RESULT')) {
    return `${targetName ?? '대상'}님은 ${
      get('isMafia') === 'true' ? '마피아였습니다' : '마피아가 아니었습니다'
    }`;
  }

  return body;
}
