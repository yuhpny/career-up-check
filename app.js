const {
  useState,
  useMemo,
  useRef,
  useEffect
} = React;
 
/*
  40代の年収アップキャリア診断（Career up check）
  - ロゴ準拠：紺(#0a2a5e) × オレンジ(#f5821f) × ゴールド(#caa14a)、白背景、"上へ伸びる道"モチーフ
  - 新規ロジック：5次元の心理特性 → コサイン類似度で4業種の方向性 + 上位特性から強み言語化
  - 結果は「事実ベースの提示」に留める（上から目線NG・断定回避ルール準拠）
  - CTAはプロフィール誘導のみ（本文にLINE/URLは置かない設計思想を継承）
*/
 
// ---- 5次元: [黙々度, 経験ベース志向, 歩合許容, 自由度, 構造志向] ----
// 各業種の理想ベクトル（0〜1）。出典素材の構造的特徴を反映（断定ではなく傾向）
const JOBS = {
  manufacturing: {
    name: "製造（期間工・軽作業）",
    vec: [0.95, 0.35, 0.25, 0.15, 0.9],
    tagline: "黙々と手を動かす時間が、いちばん落ち着く",
    rangeLow: 350,
    rangeHigh: 450,
    // 額面の目安（万円）
    rangeNote: "額面28〜31.5万の求人で年350〜450万帯（残業・深夜手当込み・会社差大）",
    points: ["OJTとマニュアルが整っていて、未経験40代の入口が広い現場が多い", "寮付き（家賃ゼロ）で固定費が下がり、手取りが残りやすい求人がある", "手順が決まっているほど力を出せるタイプと相性がいい"],
    note: "額面・寮費・祝い金は会社とキャンペーン時期で差が大きいです。応募前に最新の募集要項で確認を。",
    lifeGain: "家賃と光熱費が浮くぶん、同じ額面でも手元に残るお金が変わってきます。",
    lifeFlat: "額面の上下より、寮で固定費が消える分の「残るお金」で見ると景色が変わります。"
  },
  taxi: {
    name: "タクシー",
    vec: [0.4, 0.45, 0.85, 0.95, 0.3],
    tagline: "決まった席より、動きながら自分のペースで",
    rangeLow: 350,
    rangeHigh: 500,
    rangeNote: "現役フルタイム・都市部で年350〜500万帯（エリア差が大きく、東京と地方で2倍近い差）",
    points: ["未経験向けに月収保証（例：一定期間の固定給）を置く会社があります", "現役フルタイム・都市部の年収は、業界平均（年金組を含む）とは別物です", "賃金体系（A型/B型/AB型）は入社前の確認が地雷回避になります"],
    note: "年収はエリア・会社・年次点で2倍近く差が出ます（都市部と地方など）。平均値の見え方にはカラクリがあります。",
    lifeGain: "歩合の上限が自分次第なので、走り方しだいで収入の天井を自分で押し上げられます。",
    lifeFlat: "額面の数字より、決まった時間に縛られず動ける働き方そのものが向き不向きの分かれ目です。"
  },
  security: {
    name: "施設警備",
    vec: [0.7, 0.95, 0.3, 0.25, 0.85],
    tagline: "歳を重ねるほど、価値が積み上がっていく",
    rangeLow: 376,
    rangeHigh: 474,
    rangeNote: "平均376万・40代後半は約474万でピーク傾向（厚労省jobtag・2023年調査／現場規模・会社で差）",
    points: ["資格・経験・宿直手当が給料に乗りやすく、年代が上がるほど上がりやすい構造です", "夜間はモニター中心・巡回は数時間に一度という現場もあります（規模により差）", "資格は一生モノで、会社を変えても持ち運べます"],
    note: "厚労省jobtag（2023年調査）では施設警備の年収は45-49歳が約474万でピーク傾向。ただし現場規模・会社で大きく変わります。",
    lifeGain: "歳をとるほど上がる珍しい構造なので、いま動けば40代後半に向けて積み上がっていきます。",
    lifeFlat: "額面の伸びより、歳をとっても下がりにくく・定年で終わりにくい安心のほうが効いてきます。"
  },
  logistics: {
    name: "物流（倉庫内作業）",
    vec: [0.85, 0.3, 0.55, 0.7, 0.45],
    tagline: "ひとりの時間が長いほど、気がラクになる",
    rangeLow: 400,
    rangeHigh: 464,
    rangeNote: "倉庫内作業（正社員）平均は約464万、フォーク資格で手当上乗せの例も（求人票ベース集計・時期で変動）",
    points: ["倉庫内作業は免許不要で、40代未経験の採用枠が開いています", "構造的な人手不足が背景で、入口自体が広い状況です", "フォークリフトなどの資格があると待遇が上がる求人があります"],
    note: "軽貨物の業務委託は経費が全額自己負担で『額面≠手取り』になりやすい点に注意。雇用なのに完全歩合などは要警戒です。",
    lifeGain: "免許不要の入口が広く、資格を足していけば待遇を自分で上げていける余地があります。",
    lifeFlat: "額面より、ひとりで黙々と進められて人付き合いが薄い働き方が合うかどうかが分かれ目です。"
  }
};
 
// ---- 設問（各選択肢が5次元へ寄与）----
const Q = [{
  t: "仕事中、いちばん集中できるのは？",
  a: [{
    l: "誰とも話さず、自分の作業に没頭しているとき",
    v: [1, 0, 0, 0, 0.3]
  }, {
    l: "手順どおりに淡々と進めているとき",
    v: [0.7, 0, 0, 0, 1]
  }, {
    l: "あちこち動いて、場面が変わり続けるとき",
    v: [0, 0, 0.3, 1, 0]
  }, {
    l: "誰かと連携して回しているとき",
    v: [0, 0.3, 0, 0.3, 0.3]
  }]
}, {
  t: "収入について、近いのは？",
  a: [{
    l: "毎月きっちり同じ額が、いちばん安心する",
    v: [0.3, 0.3, 0, 0, 0.5]
  }, {
    l: "がんばった分だけ増えるなら、変動はあっていい",
    v: [0, 0, 1, 0.5, 0]
  }, {
    l: "今より少しでも上がるなら、やり方は問わない",
    v: [0.2, 0.2, 0.5, 0.2, 0.2]
  }, {
    l: "歳をとっても下がらない仕事がいい",
    v: [0.3, 1, 0, 0, 0.4]
  }]
}, {
  t: "体力について、正直なところは？",
  a: [{
    l: "重いもの・長時間の立ち仕事は、もうキツい",
    v: [0.4, 1, 0, 0, 0.4]
  }, {
    l: "動くのは平気。むしろじっとしてる方が苦手",
    v: [0, 0, 0.4, 1, 0]
  }, {
    l: "決まった作業の繰り返しなら、体は続く",
    v: [0.8, 0.2, 0, 0, 0.8]
  }, {
    l: "夜勤や宿直も、手当が付くならやれる",
    v: [0.5, 0.6, 0.2, 0, 0.6]
  }]
}, {
  t: "新しい職場に入るとき、不安が小さいのは？",
  a: [{
    l: "やることが明確にマニュアル化されている",
    v: [0.6, 0, 0, 0, 1]
  }, {
    l: "未経験でも研修で一から教えてもらえる",
    v: [0.5, 0.2, 0.2, 0.2, 0.6]
  }, {
    l: "自分の裁量で動ける余地がある",
    v: [0, 0.2, 0.4, 1, 0]
  }, {
    l: "資格や経験が、ちゃんと評価される",
    v: [0.3, 1, 0, 0, 0.5]
  }]
}, {
  t: "人間関係について、ラクなのは？",
  a: [{
    l: "ひとりで完結する仕事。気をつかわなくていい",
    v: [1, 0, 0, 0.3, 0.2]
  }, {
    l: "お客さんとは関わるが、職場の人付き合いは薄め",
    v: [0.4, 0.2, 0.4, 0.7, 0]
  }, {
    l: "決まった相手と、決まったやり取りだけ",
    v: [0.5, 0.3, 0, 0, 0.7]
  }, {
    l: "来訪者対応など、礼儀正しさが活きる場面",
    v: [0.3, 0.8, 0, 0, 0.5]
  }]
}, {
  t: "「この歳で未経験」について、本音は？",
  a: [{
    l: "手順を覚えれば歳は関係ない仕事がいい",
    v: [0.8, 0.1, 0, 0, 0.9]
  }, {
    l: "むしろ歳を重ねた分、評価される仕事がいい",
    v: [0.3, 1, 0, 0, 0.5]
  }, {
    l: "若い人と同じ土俵じゃない入口を探したい",
    v: [0.4, 0.5, 0.3, 0.3, 0.3]
  }, {
    l: "とにかく今より収入が上がる入口がほしい",
    v: [0.2, 0.2, 0.7, 0.4, 0.2]
  }]
}, {
  t: "休日や働く時間について、希望は？",
  a: [{
    l: "シフトが固定で、予定が立てやすいのがいい",
    v: [0.5, 0.3, 0, 0, 0.7]
  }, {
    l: "自分で時間を組めるなら、多少不規則でもいい",
    v: [0.2, 0.2, 0.5, 1, 0]
  }, {
    l: "夜勤・宿直で手当が増えるなら歓迎",
    v: [0.5, 0.6, 0.2, 0, 0.5]
  }, {
    l: "とにかく拘束が読める仕事が安心",
    v: [0.6, 0.4, 0, 0, 0.6]
  }]
}, {
  t: "1日の終わりに「いい日だった」と思うのは？",
  a: [{
    l: "決めた量を、ミスなく終えられた日",
    v: [0.9, 0.1, 0, 0, 0.9]
  }, {
    l: "いろんな場所に行って、変化があった日",
    v: [0, 0, 0.3, 1, 0]
  }, {
    l: "売上や成果が、数字で見えた日",
    v: [0, 0.2, 1, 0.4, 0]
  }, {
    l: "任された現場を、無事に守りきれた日",
    v: [0.5, 0.8, 0, 0, 0.6]
  }]
}, {
  t: "次の中で、いちばん「ありがたい」と感じるのは？",
  a: [{
    l: "寮付きで、家賃や光熱費の固定費が浮くこと",
    v: [0.7, 0.2, 0.2, 0, 0.6]
  }, {
    l: "がんばりが、そのまま給料に反映されること",
    v: [0.1, 0.1, 1, 0.4, 0]
  }, {
    l: "歳をとっても、給料が下がらないこと",
    v: [0.4, 1, 0, 0, 0.4]
  }, {
    l: "毎日いろんな場所に行けて、景色が変わること",
    v: [0, 0, 0.3, 1, 0]
  }]
}, {
  t: "最後に。今、転職で「これだけは」と思うのは？",
  a: [{
    l: "黙々と続けられて、長く働ける仕事",
    v: [1, 0.4, 0, 0, 0.7]
  }, {
    l: "動きながら、収入の上限を自分で伸ばせる仕事",
    v: [0, 0, 0.9, 1, 0]
  }, {
    l: "経験と資格が、ずっと武器になる仕事",
    v: [0.3, 1, 0, 0, 0.6]
  }, {
    l: "ひとりで気楽に、自分のペースで進められる仕事",
    v: [0.9, 0.1, 0.3, 0.6, 0.3]
  }]
}];
const DIMS = ["黙々と向き合う力", "経験が値段になる適性", "成果で伸ばす志向", "動きながら働く適性", "手順で力を出す力"];
 
// ---- 現状年収帯（方向判定とは別レイヤー。差分表示のためだけに使う）----
const INCOME = [{
  l: "250万くらい / それ以下",
  mid: 250
}, {
  l: "300万くらい",
  mid: 300
}, {
  l: "350万くらい",
  mid: 350
}, {
  l: "400万くらい",
  mid: 400
}, {
  l: "450万くらい",
  mid: 450
}, {
  l: "500万以上",
  mid: 520
}, {
  l: "答えたくない / 今は無職",
  mid: null
}];
function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
const ACCOUNT = "@40.tenshoku"; // Threadsの@ユーザー名
const BOOKING_URL = "https://career-up-check.vercel.app/booking.html"; // 面談予約フォームのURL
 
function CareerUpCheck() {
  const [step, setStep] = useState(-1); // -1: intro, 0..Q-1: questions, Q: income, Q+1: result
  const [ans, setAns] = useState(Array(Q.length).fill(null));
  const [income, setIncome] = useState(null); // INCOMEのindex
  const topRef = useRef(null);
  const INCOME_STEP = Q.length; // 年収設問のstep番号
  const RESULT_STEP = Q.length + 1; // 結果のstep番号
 
  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [step]);
  const result = useMemo(() => {
    if (ans.some(a => a === null) || income === null) return null;
    const sum = [0, 0, 0, 0, 0];
    ans.forEach((ai, qi) => {
      const v = Q[qi].a[ai].v;
      for (let d = 0; d < 5; d++) sum[d] += v[d];
    });
    const scored = Object.entries(JOBS).map(([key, j]) => ({
      key,
      ...j,
      score: cosine(sum, j.vec)
    })).sort((a, b) => b.score - a.score);
    const total = sum.reduce((x, y) => x + y, 0) || 1;
    const profile = DIMS.map((label, d) => ({
      label,
      pct: Math.round(sum[d] / total * 100)
    })).sort((a, b) => b.pct - a.pct);
    const top = scored[0];
    const now = INCOME[income].mid; // null=未回答
    // 差分判定：到達レンジ上限が現状を明確に上回るか
    let money = "unknown";
    if (now !== null) {
      if (top.rangeHigh - now >= 30) money = "up"; // 上振れ余地あり
      else if (now - top.rangeLow >= 40) money = "flat"; // 現状が高め＝額面より質で語る
      else money = "match"; // ほぼ同等
    }
    return {
      top,
      second: scored[1],
      profile,
      now,
      money
    };
  }, [ans, income]);
  const progress = step >= 0 && step < Q.length ? Math.round(step / (Q.length + 1) * 100) : step === INCOME_STEP ? Math.round(Q.length / (Q.length + 1) * 100) : 0;
  const pick = (qi, ai) => {
    const next = [...ans];
    next[qi] = ai;
    setAns(next);
    setTimeout(() => setStep(qi + 1), 180);
  };
  const pickIncome = i => {
    setIncome(i);
    setTimeout(() => setStep(RESULT_STEP), 180);
  };
  const reset = () => {
    setAns(Array(Q.length).fill(null));
    setIncome(null);
    setStep(-1);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "cu-root",
    ref: topRef
  }, /*#__PURE__*/React.createElement("style", null, css), /*#__PURE__*/React.createElement("div", {
    className: "cu-shell"
  }, /*#__PURE__*/React.createElement(RoadBg, null), /*#__PURE__*/React.createElement("header", {
    className: "cu-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-badge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-badge-40"
  }, "40"), /*#__PURE__*/React.createElement("span", {
    className: "cu-badge-dai"
  }, "代"), /*#__PURE__*/React.createElement("span", {
    className: "cu-badge-sub"
  }, "転職")), /*#__PURE__*/React.createElement("p", {
    className: "cu-kicker"
  }, "無料・3分・全11問")), step === -1 && /*#__PURE__*/React.createElement("section", {
    className: "cu-card cu-intro"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "cu-title"
  }, "40代の", /*#__PURE__*/React.createElement("span", {
    className: "cu-or"
  }, "年収アップ"), /*#__PURE__*/React.createElement("br", null), "キャリア診断"), /*#__PURE__*/React.createElement("p", {
    className: "cu-lead cu-lead-sm"
  }, "答えるのは11問。あなたの", /*#__PURE__*/React.createElement("strong", null, "強み"), "と、製造・タクシー・施設警備・物流のうち", /*#__PURE__*/React.createElement("strong", null, "どの方向だと年収がどう変わるか"), "、その先で", /*#__PURE__*/React.createElement("strong", null, "生活がどう変わるか"), "まで出ます。"), /*#__PURE__*/React.createElement("button", {
    className: "cu-btn cu-btn-primary",
    onClick: () => setStep(0)
  }, "診断をはじめる", /*#__PURE__*/React.createElement(Arrow, null)), /*#__PURE__*/React.createElement("p", {
    className: "cu-fine"
  }, "※合否や優劣ではなく「方向性と年収の目安」です。会社・エリア・年次点で実態は変わります。")), step >= 0 && step < Q.length && /*#__PURE__*/React.createElement("section", {
    className: "cu-card cu-q"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-progress-bar",
    style: {
      width: `${progress}%`
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "cu-qnum"
  }, "Q", step + 1, " ", /*#__PURE__*/React.createElement("span", null, "/ ", Q.length + 1)), /*#__PURE__*/React.createElement("h2", {
    className: "cu-qtext"
  }, Q[step].t), /*#__PURE__*/React.createElement("div", {
    className: "cu-opts"
  }, Q[step].a.map((o, ai) => /*#__PURE__*/React.createElement("button", {
    key: ai,
    className: `cu-opt ${ans[step] === ai ? "is-on" : ""}`,
    onClick: () => pick(step, ai)
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-opt-dot"
  }), /*#__PURE__*/React.createElement("span", null, o.l)))), /*#__PURE__*/React.createElement("div", {
    className: "cu-qnav"
  }, step > 0 && /*#__PURE__*/React.createElement("button", {
    className: "cu-link",
    onClick: () => setStep(step - 1)
  }, "← 前の質問"))), step === INCOME_STEP && /*#__PURE__*/React.createElement("section", {
    className: "cu-card cu-q"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-progress-bar",
    style: {
      width: `${progress}%`
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "cu-qnum"
  }, "Q", Q.length + 1, " ", /*#__PURE__*/React.createElement("span", null, "/ ", Q.length + 1, "（最後）")), /*#__PURE__*/React.createElement("h2", {
    className: "cu-qtext"
  }, "今の年収は、だいたいどのあたりですか？"), /*#__PURE__*/React.createElement("p", {
    className: "cu-qhelp"
  }, "この方向に動くと「今と比べてどう変わるか」を出すために使います。正確でなくて大丈夫です。"), /*#__PURE__*/React.createElement("div", {
    className: "cu-opts"
  }, INCOME.map((o, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: `cu-opt ${income === i ? "is-on" : ""}`,
    onClick: () => pickIncome(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-opt-dot"
  }), /*#__PURE__*/React.createElement("span", null, o.l)))), /*#__PURE__*/React.createElement("div", {
    className: "cu-qnav"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cu-link",
    onClick: () => setStep(Q.length - 1)
  }, "← 前の質問"))), step === RESULT_STEP && result && /*#__PURE__*/React.createElement(Result, {
    result: result,
    onReset: reset
  }), /*#__PURE__*/React.createElement("footer", {
    className: "cu-foot"
  }, "40代転職 / 年収アップキャリア診断")));
}
function Result({
  result,
  onReset
}) {
  const {
    top,
    second,
    profile,
    now,
    money
  } = result;
  // 予約フォームへ診断結果を引き継ぐ（GAS側の列に対応）
  const bookingHref = (() => {
    if (!BOOKING_URL || BOOKING_URL === "#") return BOOKING_URL;
    const topStr = `1位:${top.name}（${top.rangeLow}〜${top.rangeHigh}万） / 2位:${second.name}（${second.rangeLow}〜${second.rangeHigh}万）`;
    const scores = profile.map(p => `${p.label}:${p.pct}`).join(" ");
    const qs = new URLSearchParams({
      type: top.name,
      top: topStr,
      scores
    });
    return `${BOOKING_URL}${BOOKING_URL.includes("?") ? "&" : "?"}${qs.toString()}`;
  })();
  return /*#__PURE__*/React.createElement("section", {
    className: "cu-card cu-result"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cu-result-eyebrow"
  }, "あなたの診断結果"), /*#__PURE__*/React.createElement("div", {
    className: "cu-result-main"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cu-result-label"
  }, "合いやすい方向"), /*#__PURE__*/React.createElement("h2", {
    className: "cu-result-job"
  }, top.name), /*#__PURE__*/React.createElement("p", {
    className: "cu-result-tag"
  }, "「", top.tagline, "」")), /*#__PURE__*/React.createElement("div", {
    className: "cu-strength"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "cu-h3"
  }, "あなたの強み"), /*#__PURE__*/React.createElement("div", {
    className: "cu-bars"
  }, profile.slice(0, 3).map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "cu-bar-row",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-bar-label"
  }, p.label), /*#__PURE__*/React.createElement("div", {
    className: "cu-bar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-bar-fill",
    style: {
      width: `${Math.min(100, p.pct * 2.2)}%`
    }
  }))))), /*#__PURE__*/React.createElement("p", {
    className: "cu-strength-note"
  }, "この3つが、あなたが現場で力を出しやすい軸です。 上位の「", profile[0].label, "」が活きる仕事ほど、長く続きやすい傾向があります。")), /*#__PURE__*/React.createElement("div", {
    className: "cu-money"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "cu-h3"
  }, "この方向で、年収はどう変わるか"), /*#__PURE__*/React.createElement("div", {
    className: "cu-money-flow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cu-money-cell cu-money-now"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-money-cap"
  }, "今のあたり"), /*#__PURE__*/React.createElement("span", {
    className: "cu-money-num"
  }, now !== null ? `${now}` : "—", /*#__PURE__*/React.createElement("small", null, now !== null ? "万" : ""))), /*#__PURE__*/React.createElement("div", {
    className: "cu-money-go"
  }, /*#__PURE__*/React.createElement(Arrow, null)), /*#__PURE__*/React.createElement("div", {
    className: "cu-money-cell cu-money-to"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-money-cap"
  }, top.name, "の目安"), /*#__PURE__*/React.createElement("span", {
    className: "cu-money-num"
  }, top.rangeLow, "–", top.rangeHigh, /*#__PURE__*/React.createElement("small", null, "万")))), /*#__PURE__*/React.createElement("p", {
    className: "cu-money-range"
  }, top.rangeNote), money === "up" && /*#__PURE__*/React.createElement("p", {
    className: "cu-money-msg cu-money-up"
  }, "今の", now, "万から見ると、この方向には上振れの余地があります。", top.lifeGain), money === "match" && /*#__PURE__*/React.createElement("p", {
    className: "cu-money-msg"
  }, "額面では今と大きく変わらない帯です。ただ", top.lifeFlat), money === "flat" && /*#__PURE__*/React.createElement("p", {
    className: "cu-money-msg"
  }, "今の", now, "万は、この職種の中ではすでに高めの位置です。だからこそ額面を追うより——", top.lifeFlat), money === "unknown" && /*#__PURE__*/React.createElement("p", {
    className: "cu-money-msg"
  }, "この方向の目安は", top.rangeLow, "〜", top.rangeHigh, "万帯です。", top.lifeGain), /*#__PURE__*/React.createElement("p", {
    className: "cu-money-fine"
  }, "※あくまで一般的な帯の目安です。実際の金額は会社・エリア・あなたの経歴・年次点で変わります。")), /*#__PURE__*/React.createElement("div", {
    className: "cu-points"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "cu-h3"
  }, top.name, "の、知っておきたいところ"), /*#__PURE__*/React.createElement("ul", null, top.points.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "cu-tick"
  }), p))), /*#__PURE__*/React.createElement("p", {
    className: "cu-points-note"
  }, top.note)), /*#__PURE__*/React.createElement("div", {
    className: "cu-second"
  }, /*#__PURE__*/React.createElement("p", null, "次に合いやすいのは ", /*#__PURE__*/React.createElement("strong", null, second.name), "。 どちらも「向いてる方向」であって、決めるのはこれからで遅くないです。")), /*#__PURE__*/React.createElement("div", {
    className: "cu-cta"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cu-cta-lead"
  }, "診断で出るのは、方向と年収の「目安」まで。"), /*#__PURE__*/React.createElement("p", {
    className: "cu-cta-sub"
  }, "ここから先は、あなたの経歴・資格・住む地域で現実的な選択肢が変わります。 どの会社のどの枠が合うかは、一人ひとり違うので、直接お話しした方が早いです。 無料の個別相談で、あなたの場合の具体的なルートを一緒に整理します。"), /*#__PURE__*/React.createElement("a", {
    className: "cu-btn cu-btn-primary cu-cta-btn",
    href: bookingHref,
    target: "_blank",
    rel: "noopener noreferrer"
  }, "無料で個別相談を予約する", /*#__PURE__*/React.createElement(Arrow, null)), /*#__PURE__*/React.createElement("p", {
    className: "cu-fine cu-cta-fine"
  }, "所要15〜30分・オンライン可・相談だけでもOKです")), /*#__PURE__*/React.createElement("div", {
    className: "cu-follow"
  }, /*#__PURE__*/React.createElement("p", null, "まずは情報だけ受け取りたい方は、", ACCOUNT, " のフォローから。40代の現場職のリアルを毎日発信しています。")), /*#__PURE__*/React.createElement("button", {
    className: "cu-link cu-retry",
    onClick: onReset
  }, "もう一度診断する"));
}
function Arrow() {
  return /*#__PURE__*/React.createElement("svg", {
    className: "cu-arrow",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h13M13 6l6 6-6 6",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
 
// 背景：下から上へS字に伸びる道（ロゴの矢印モチーフを抽象化）
function RoadBg() {
  return /*#__PURE__*/React.createElement("svg", {
    className: "cu-road",
    viewBox: "0 0 400 600",
    preserveAspectRatio: "xMidYMax slice",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "road",
    x1: "0",
    y1: "1",
    x2: "0",
    y2: "0"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#1e63c8",
    stopOpacity: "0.16"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "60%",
    stopColor: "#1e63c8",
    stopOpacity: "0.08"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#0a2a5e",
    stopOpacity: "0.03"
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: "roadEdge",
    x1: "0",
    y1: "1",
    x2: "0",
    y2: "0"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#0a2a5e",
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#0a2a5e",
    stopOpacity: "0.02"
  }))), /*#__PURE__*/React.createElement("path", {
    d: "M70 600 C 120 460, 40 380, 150 300 C 250 230, 180 150, 270 60 L 320 90 C 230 175, 300 250, 200 320 C 110 385, 185 460, 130 600 Z",
    fill: "url(#road)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M270 60 L 250 100 L 300 95 Z",
    fill: "url(#roadEdge)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M100 600 C 150 470, 70 390, 175 312",
    stroke: "#caa14a",
    strokeOpacity: "0.25",
    strokeWidth: "2",
    strokeDasharray: "3 10",
    fill: "none",
    strokeLinecap: "round"
  }));
}
const css = `
  .cu-root{
    --navy:#0a2a5e; --navy2:#1e63c8; --or:#f5821f; --or2:#ff9a33;
    --gold:#caa14a; --ink:#15233d; --mute:#5b6b85; --line:#e6ebf3; --bg:#fbfcfe;
    font-family: "Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;
    color:var(--ink); background:
      radial-gradient(120% 80% at 100% 0%, #eef4fd 0%, rgba(238,244,253,0) 55%),
      var(--bg);
    min-height:100%; padding:24px 16px 40px; box-sizing:border-box;
    -webkit-font-smoothing:antialiased;
  }
  .cu-shell{ position:relative; max-width:560px; margin:0 auto; }
  .cu-road{ position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; }
  .cu-head,.cu-card,.cu-foot{ position:relative; z-index:1; }
 
  .cu-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .cu-badge{ display:flex; align-items:baseline; gap:2px;
    border:2px solid var(--navy); border-radius:999px; padding:6px 16px; background:#fff;
    box-shadow:0 2px 0 rgba(10,42,94,0.12); }
  .cu-badge-40{ font-weight:900; font-size:24px; color:var(--or);
    font-family:"Times New Roman",serif; letter-spacing:-1px; line-height:1; }
  .cu-badge-dai{ font-weight:800; font-size:14px; color:var(--navy); }
  .cu-badge-sub{ font-weight:800; font-size:15px; color:var(--navy); margin-left:6px;
    border-left:1px solid var(--gold); padding-left:8px; letter-spacing:1px; }
  .cu-kicker{ margin:0; font-size:12px; font-weight:700; color:var(--navy2);
    background:#eaf1fc; padding:5px 12px; border-radius:999px; }
 
  .cu-card{ background:#fff; border:1px solid var(--line); border-radius:20px;
    padding:30px 26px; box-shadow:0 18px 40px -28px rgba(10,42,94,0.4); }
 
  /* intro */
  .cu-title{ margin:0 0 16px; font-size:32px; font-weight:900; line-height:1.25;
    letter-spacing:-0.5px; color:var(--navy); }
  .cu-or{ color:var(--or); position:relative; }
  .cu-or::after{ content:""; position:absolute; left:0; right:0; bottom:-2px; height:3px;
    background:linear-gradient(90deg,var(--gold),transparent); border-radius:2px; }
  .cu-lead{ margin:0 0 14px; font-size:15.5px; line-height:1.85; color:var(--ink); }
  .cu-lead-sm{ font-size:14.5px; color:var(--mute); }
  .cu-lead strong{ color:var(--navy); font-weight:800; }
  .cu-fine{ margin:16px 0 0; font-size:12px; color:var(--mute); line-height:1.7; }
 
  .cu-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px;
    border:none; cursor:pointer; font-weight:800; border-radius:14px;
    transition:transform .12s ease, box-shadow .12s ease, filter .12s ease; }
  .cu-btn-primary{ width:100%; margin-top:22px; padding:18px;
    font-size:16.5px; color:#fff;
    background:linear-gradient(135deg,var(--or) 0%,var(--or2) 100%);
    box-shadow:0 10px 22px -10px rgba(245,130,31,0.7); }
  .cu-btn-primary:hover{ transform:translateY(-2px); box-shadow:0 16px 28px -12px rgba(245,130,31,0.8); }
  .cu-btn-primary:active{ transform:translateY(0); }
  .cu-arrow{ width:20px; height:20px; }
 
  /* question */
  .cu-progress{ height:6px; background:#eef2f8; border-radius:999px; overflow:hidden; margin-bottom:20px; }
  .cu-progress-bar{ height:100%; border-radius:999px;
    background:linear-gradient(90deg,var(--navy2),var(--or)); transition:width .3s ease; }
  .cu-qnum{ margin:0 0 8px; font-weight:900; color:var(--navy2); font-size:14px; }
  .cu-qnum span{ color:var(--mute); font-weight:700; }
  .cu-qtext{ margin:0 0 22px; font-size:21px; font-weight:900; line-height:1.5; color:var(--navy); }
  .cu-qhelp{ margin:-12px 0 20px; font-size:13px; line-height:1.7; color:var(--mute); }
  .cu-opts{ display:flex; flex-direction:column; gap:11px; }
  .cu-opt{ display:flex; align-items:center; gap:13px; text-align:left;
    padding:16px 16px; border:1.5px solid var(--line); border-radius:14px; background:#fff;
    font-size:15px; line-height:1.55; color:var(--ink); cursor:pointer;
    transition:border-color .12s ease, background .12s ease, transform .08s ease; font-weight:600; }
  .cu-opt:hover{ border-color:var(--navy2); background:#f6f9ff; }
  .cu-opt:active{ transform:scale(0.99); }
  .cu-opt.is-on{ border-color:var(--or); background:#fff7ef; }
  .cu-opt-dot{ flex:0 0 18px; width:18px; height:18px; border-radius:50%;
    border:2px solid #c5cfe0; transition:all .12s ease; }
  .cu-opt.is-on .cu-opt-dot{ border-color:var(--or); background:var(--or);
    box-shadow:inset 0 0 0 3px #fff; }
  .cu-qnav{ margin-top:18px; }
  .cu-link{ background:none; border:none; color:var(--navy2); font-weight:700;
    font-size:14px; cursor:pointer; padding:4px 0; }
  .cu-link:hover{ text-decoration:underline; }
 
  /* result */
  .cu-result-eyebrow{ margin:0 0 6px; font-size:12px; font-weight:800; letter-spacing:2px;
    color:var(--gold); text-transform:uppercase; }
  .cu-result-main{ text-align:center; padding:18px 0 24px; border-bottom:1px solid var(--line); }
  .cu-result-label{ margin:0 0 8px; font-size:13px; font-weight:700; color:var(--mute); }
  .cu-result-job{ margin:0; font-size:30px; font-weight:900; color:var(--navy);
    letter-spacing:-0.5px; line-height:1.3; }
  .cu-result-tag{ margin:12px 0 0; font-size:15px; color:var(--or); font-weight:800; }
 
  .cu-h3{ margin:0 0 14px; font-size:16px; font-weight:900; color:var(--navy);
    display:flex; align-items:center; gap:8px; }
  .cu-h3::before{ content:""; width:4px; height:16px; border-radius:2px;
    background:linear-gradient(var(--or),var(--gold)); }
 
  .cu-strength{ padding:24px 0; border-bottom:1px solid var(--line); }
  .cu-bars{ display:flex; flex-direction:column; gap:13px; }
  .cu-bar-row{ display:flex; align-items:center; gap:12px; }
  .cu-bar-label{ flex:0 0 130px; font-size:13.5px; font-weight:700; color:var(--ink); }
  .cu-bar-track{ flex:1; height:10px; background:#eef2f8; border-radius:999px; overflow:hidden; }
  .cu-bar-fill{ height:100%; border-radius:999px;
    background:linear-gradient(90deg,var(--navy2),var(--or)); }
  .cu-strength-note{ margin:16px 0 0; font-size:13.5px; line-height:1.8; color:var(--mute); }
  .cu-strength-note + *, .cu-bar-row strong{ }
 
  .cu-money{ padding:24px 0; border-bottom:1px solid var(--line); }
  .cu-money-flow{ display:flex; align-items:stretch; gap:10px; }
  .cu-money-cell{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:4px; padding:16px 8px; border-radius:14px; text-align:center; }
  .cu-money-now{ background:#f2f5fa; border:1px solid var(--line); }
  .cu-money-to{ background:linear-gradient(160deg,#fff7ef,#ffefdc); border:1.5px solid #ffd9ad; }
  .cu-money-cap{ font-size:11.5px; font-weight:700; color:var(--mute); }
  .cu-money-to .cu-money-cap{ color:#c2700f; }
  .cu-money-num{ font-size:26px; font-weight:900; color:var(--navy); line-height:1;
    font-family:"Times New Roman",serif; letter-spacing:-0.5px; }
  .cu-money-to .cu-money-num{ color:var(--or); }
  .cu-money-num small{ font-size:13px; margin-left:2px; font-family:inherit; }
  .cu-money-go{ display:flex; align-items:center; color:var(--gold); }
  .cu-money-go .cu-arrow{ width:24px; height:24px; }
  .cu-money-range{ margin:12px 0 0; font-size:12.5px; line-height:1.7; color:var(--mute); }
  .cu-money-msg{ margin:14px 0 0; font-size:14.5px; line-height:1.85; color:var(--ink);
    background:#f7f9fc; border-radius:10px; padding:14px 15px; font-weight:600; }
  .cu-money-up{ background:#fff7ef; }
  .cu-money-fine{ margin:12px 0 0; font-size:11.5px; line-height:1.7; color:var(--mute); }
 
  .cu-points{ padding:24px 0; border-bottom:1px solid var(--line); }
  .cu-points ul{ margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:12px; }
  .cu-points li{ display:flex; gap:10px; font-size:14.5px; line-height:1.7; color:var(--ink); }
  .cu-tick{ flex:0 0 18px; width:18px; height:18px; margin-top:2px; border-radius:50%;
    background:#eaf1fc; position:relative; }
  .cu-tick::after{ content:""; position:absolute; left:5px; top:5px; width:5px; height:8px;
    border-right:2px solid var(--navy2); border-bottom:2px solid var(--navy2);
    transform:rotate(45deg); }
  .cu-points-note{ margin:16px 0 0; font-size:12.5px; line-height:1.8; color:var(--mute);
    background:#f7f9fc; border-left:3px solid var(--gold); padding:12px 14px; border-radius:0 8px 8px 0; }
 
  .cu-second{ padding:22px 0; }
  .cu-second p{ margin:0; font-size:14.5px; line-height:1.8; color:var(--ink); }
  .cu-second strong{ color:var(--navy); font-weight:800; }
 
  .cu-cta{ margin-top:6px; padding:26px 22px; border-radius:16px; box-sizing:border-box;
    background:linear-gradient(160deg,#0a2a5e 0%,#143a78 100%); color:#fff; text-align:center; }
  .cu-cta-lead{ margin:0 0 14px; font-size:16px; line-height:1.8; font-weight:800; }
  .cu-cta-sub{ margin:0 0 4px; font-size:13.5px; line-height:1.7; color:#cdd9ef; }
  .cu-cta-btn{ margin-top:18px; box-sizing:border-box; }
  .cu-cta-btn{ box-shadow:0 8px 18px -10px rgba(245,130,31,0.6); }
  .cu-cta-btn:hover{ transform:none; box-shadow:0 10px 20px -10px rgba(245,130,31,0.7); }
  .cu-cta-fine{ color:#aebfdf; margin-top:14px; }
 
  .cu-follow{ margin-top:16px; padding:16px 18px; border:1px solid var(--line);
    border-radius:14px; background:#f9fbfe; }
  .cu-follow p{ margin:0; font-size:13px; line-height:1.75; color:var(--mute); }
 
  .cu-retry{ display:block; margin:20px auto 0; }
 
  .cu-foot{ text-align:center; margin-top:22px; font-size:11.5px; color:var(--mute);
    letter-spacing:1px; }
 
  @media (max-width:480px){
    .cu-card{ padding:26px 20px; }
    .cu-title{ font-size:27px; }
    .cu-result-job{ font-size:25px; }
    .cu-qtext{ font-size:19px; }
    .cu-bar-label{ flex-basis:108px; font-size:12.5px; }
  }
  @media (prefers-reduced-motion:reduce){
    .cu-btn,.cu-opt,.cu-progress-bar,.cu-bar-fill{ transition:none; }
  }
`;
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(CareerUpCheck));
