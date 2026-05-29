export default {
  lang: '中文',
  brand: {
    name: '艺芽',
  },
  home: {
    nav: {
      home: '首页',
      tutorial: '使用指南',
      contact: '联系我们',
      access: '进入',
    },
    access: {
      title: '使用邀请码访问',
      subtitle: '请使用研究团队提供的邀请码访问 艺芽',
      placeholder: '输入邀请码',
      submit: '进入 艺芽',
      closeAria: '关闭访问弹窗',
    },
    hero: {
      titleArt: '艺',
      titleBloom: '芽',
      description:
        '面向小学美术课堂的 AI 教学工作流，帮助老师在备课、授课、创作引导和反馈之间顺畅切换。',
      captionTopRight: '从教材出发，构建故事与互动。',
      captionBottomRight: '在创作过程中提供可视化的指导与反馈。',
      mainImageAlt: '艺芽 主视觉插画',
      photo1Alt: '老师在电脑上备课',
      photo2Alt: '孩子们在课堂上用蜡笔绘画',
      photo3Alt: '美术教室中的师生互动',
    },
    tutorial: {
      title: '使用指南',
      subtitle: '从教材出发，按步骤搭建结构化的课堂幻灯片。',
      intro:
        '艺芽 不是传统的幻灯片编辑器，而是围绕备课、课堂教学和课中辅助而设计的教学工作流系统。',
      introBold: '艺芽',
      bannerAlt: '使用指南横幅',
      steps: [
        {
          title: '选择一节教材课文',
          body: '选择你想要教授的年级、册别、单元与课时。',
        },
        {
          title: 'AI 辅助创作',
          body: '使用 艺芽 获得文本建议、故事生成、动画生成与页面级润色。',
        },
        {
          title: '构建结构化课件',
          body: '在引导式的页面结构中编辑课堂内容。',
        },
        {
          title: '预览课程',
          body: '在进入授课模式前检查页面顺序、媒体播放与互动流程。',
        },
        {
          title: '开始上课',
          body: '直接进入演示模式，在课堂上完成完整的教学。',
        },
      ],
    },
    contact: {
      title: '联系我们',
      subtitle:
        '如果你对 艺芽 的使用、试点参与、研究合作或反馈有任何问题，欢迎与研究团队联系。',
      bannerAlt: '联系我们横幅',
      helpTitle: '我们能帮你什么',
      helpItems: [
        {
          title: '使用支持',
          body: '邀请码、登录、课程编辑和授课模式相关问题',
        },
        {
          title: '研究合作',
          body: '试点研究、学校合作与学术交流',
        },
        {
          title: '反馈建议',
          body: '功能建议、Bug 反馈与使用体验评价',
        },
      ],
      emailLabel: '邮箱',
      // 2026-05 — vue-i18n 把 `@` 视作 linked-message 语法的起始符
      // (`@:foo`, `@.upper`, `@@`)。生产构建的 vue-i18n 运行时遇到
      // `@163.com` 这种"@ 后非保留 token"的串会直接 throw
      // `SyntaxError: Invalid linked format`，导致依赖此 key 的
      // `<ContactInfoCard>` 在 setup 阶段崩溃，进而影响兄弟节点
      // `<ContactForm>` 的渲染（dev 构建只 warn，所以本地看着正常）。
      // 用 `{'@'}` 字面量插值转义即可，输出仍为 machi2019uk@163.com。
      emailValue: "machi2019uk{'@'}163.com",
      wechatLabel: '微信',
      wechatValue: 'chi_chi_131',
      form: {
        nameLabel: '姓名',
        namePlaceholder: '请输入您的姓名',
        // 兼容旧 key（暂留以防其他组件引用）。
        firstNamePlaceholder: '名',
        lastNamePlaceholder: '姓',
        emailLabel: '邮箱',
        // 2026-05 — 占位提示更新为真实示例联系方式（脱敏后的）。原
        // 文本是 Figma 模板自带的英美格式占位，对国内老师不够直观。
        // 同上：转义 `@`，避免 vue-i18n linked-format 解析报错。
        emailPlaceholder: "1234567890{'@'}163.com",
        phoneLabel: '手机',
        phonePlaceholder: '+86 12345678900',
        messageLabel: '信息',
        messagePlaceholder: '请输入您的留言',
        send: '发送',
        required: '必填',
      },
    },
  },
  nav: {
    back: '返回',
    previewLesson: '预览课程',
    startTeaching: '开始上课',
  },
  lessonSelect: {
    title: '选择教材课文，开始备课',
    grade: '{n}年级',
    volume: '第{n}册',
    unit: '第{n}单元',
    lesson: '第{n}课',
    backToVolumes: '返回教材选择',
    closeAria: '关闭课程选择',
    volumeAria: '打开 {grade} 年级第 {volume} 册',
  },
  community: {
    title: '课件社区',
    subtitle: '浏览社区共享的幻灯片课件，从其他老师的课程中获取灵感。',
    backToDashboard: '返回工作台',
    heroAlt: '装饰性绘制图形',
    gridAria: '共享的课件',
    filters: {
      aria: '筛选社区课程',
      gradeLevel: '年级',
      unit: '单元',
      lesson: '课时',
      allGrades: '全部年级',
      allUnits: '全部单元',
      allLessons: '全部课时',
      discover: '查找',
    },
    card: {
      preview: '预览',
      save: '收藏',
      saved: '已收藏',
      unitLessonShort: '第{unit}单元 • 第{lesson}课',
    },
    team: '艺芽团队',
    preview: {
      title: '课件预览',
      slideOf: '第 {part} 部分 · 第 {n} 张',
      close: '关闭',
      empty: '本课暂时没有幻灯片。',
    },
    save: {
      savedToMyLessons: '已添加到我的课件',
      alreadySaved: '已在我的课件中',
    },
    pagination: {
      aria: '分页',
      prev: '上一页',
      next: '下一页',
    },
  },

  dashboardHub: {
    title: '工作台',
    subtitle:
      '欢迎使用 艺芽 工作台。在这里，你可以创建幻灯片课件、管理教学素材，并快速回到日常的备课与授课流程。',
    greeting: '你好，{name}',
    homeAriaLabel: '返回首页',
    dashboardAriaLabel: 'Go to dashboard',
    accountAriaLabel: '打开我的账号',
    avatarAlt: '用户头像',
    heroAlt: '装饰性绘制图形',
    entryAriaLabel: '打开 {title}',
    cards: {
      createLesson: {
        title: '新建课件',
        description: '从教材课文出发，创建结构化的全新幻灯片课件。',
      },
      myLessons: {
        title: '我的课件',
        description: '查看、编辑和管理你已创建、保存或正在使用的幻灯片课件。',
      },
      community: {
        title: '课件社区',
        description: '浏览社区共享的幻灯片课件，将有用的课件加入到你的教学流程中。',
      },
      startTeaching: {
        title: '开始上课',
        description: '快速选择一份已完成的幻灯片课件，进入授课模式。',
      },
      myAccount: {
        title: '我的账号',
        description: '查看账号信息并提交反馈。',
      },
    },
    // 2026-05 — "开始上课" 卡片打开的右侧抽屉。空态 / 列表态共用
    // 同一组 keys，组件内根据 `projects.length` 切换布局。
    startTeachingDrawer: {
      title: '开始上课',
      subtitle: '选择已完成或最近使用的课件，进入授课模式。',
      readyToTeach: '可立即上课',
      recentlyUsed: '最近使用',
      startTeaching: '开始上课',
      preview: '预览',
      closeAria: '关闭抽屉',
      empty: {
        title: '暂无课件',
        body: '创建你的第一堂美术课吧。',
        create: '新建课件',
      },
    },
  },
  account: {
    title: '我的账号',
    backToDashboard: '返回工作台',
    welcome: '欢迎你，{name}',
    subtitle: '管理你的资料、提交反馈，并保持创作灵感。',
    decorAlt: '装饰性的师生拼贴图',
    profile: {
      displayName: '显示名称',
      displayNamePlaceholder: '设置一个显示名称',
      bio: '教学格言',
      bioPlaceholder: '分享一句你的教学格言或简介…',
      editAvatarAria: '编辑头像',
    },
    inviteCode: {
      label: '邀请码',
    },
    feedback: {
      title: '帮助我们改进 艺芽',
      body: '我们很想听到你对功能的体验和建议。你的反馈将塑造 艺芽 的下一个版本。',
      send: '提交反馈',
    },
    quote: {
      text: '"每个孩子都是艺术家。问题是长大后如何继续做一名艺术家。" —— 毕加索',
    },
    picker: {
      title: '选择你的头像',
      ariaLabel: '头像选择器',
      closeAria: '关闭头像选择器',
    },
    signOut: '退出登录',
  },
  dashboard: {
    myLessons: '我的课件',
    subtitle: '查看、编辑、管理并开始教授你创建、保存或正在使用的幻灯片课件。',
    createLesson: '新建课件',
    newLesson: '+ 新建课件',
    noLessons: '暂无课件',
    noLessonsDesc: '创建你的第一堂美术课吧。',
    partProgress: '第 {n} 部分，共 7 部分',
    resume: '继续编辑',
    deleteLesson: '删除课件',
    untitled: '未命名课件',
    slides: '张幻灯片',
    created: '创建于',
    stats: {
      totalSlides: '幻灯片总页数',
      totalSlidesDesc: '所有已创建的幻灯片',
      readyToTeach: '可开始教授',
      readyToTeachDesc: '已发布，准备就绪',
      drafts: '草稿',
      draftsDesc: '进行中',
      shared: '已分享',
      sharedDesc: '与他人共享',
    },
    tabs: {
      all: '全部课件',
      completed: '已完成',
      drafts: '草稿',
      saved: '已保存',
      taught: '已教授',
    },
    col: {
      deck: '幻灯片',
      unit: '单元 / 课时',
      lastEdited: '最后编辑',
      status: '状态',
      actions: '操作',
    },
    actions: {
      edit: '编辑',
      preview: '预览',
      startTeaching: '开始上课',
      delete: '删除',
    },
    modal: {
      newTitle: '新建课件',
      namePlaceholder: '课件名称',
      cancel: '取消',
      create: '创建',
      deleteTitle: '删除课件？',
      deleteDesc: '此操作不可撤销。',
      delete: '删除',
    },
  },
  sidebar: {
    pageList: '页面列表',
    deleteSlide: '删除',
    // Sidebar part titles — copy provided by the curriculum team
    // (2026-05). These supersede the earlier literal translations of
    // the EN counterparts; both languages now use the curriculum's
    // canonical phrasing.
    parts: [
      '第一部分：课程导入',
      '第二部分：新知讲授',
      '第三部分：故事动画',
      '第四部分：课堂实践',
      '第五部分：创意示范',
      '第六部分：风格创作',
      '第七部分：展示评价',
    ],
  },
  content: {
    fontFamily: '字体',
    weight: '字重',
    size: '大小',
    alignment: '对齐',
    textColor: '文字颜色',
    flip: '翻转',
    noSelection: '点击 Tt 添加文字，或选择元素进行编辑。',
    noSlide: '添加幻灯片以开始。',
    save: '保存',
    saveNext: '下一部分',
    defaultText: '双击编辑',
    imageMenu: {
      addAsElement: '添加为元素',
      uploadImage: '上传图片',
      // 2026-05-28: `generateImage` removed site-wide — no backend, was a
      // no-op stub. See note in `WorkspaceContent.vue` next to the deleted
      // `generateImage()` handler. Restore here + matching button in the
      // template if/when a real image-gen service ships.
      slideBackground: '幻灯片背景',
      uploadBackground: '上传背景',
      solidColor: '纯色',
      // 2026-05-28: `resetToGlobal` removed together with the
      // master-slide / global-theme feature. Each slide's background
      // is now independent; there is no theme to revert to.
    },
  },
  part3: {
    emptyState: '点击侧边栏的 + 添加第一张作品',
    uploadLabel: '点击上传作品图片',
    // 画布占位文案 — 教师尚未选择画作时显示。文案改为指向
    // 左侧画作缩略图列表（原文 "在上方" 在最终布局下已不准确）。
    uploadOrPick: '请从左侧选择你想生成故事和动画的课本插图',
    pickArtworkLabel: '本课推荐画作',
    loadingArtwork: '正在加载画作…',
    replaceImage: '更换图片',

    remainingAttempts: '剩余生成次数：{n} / 3',
    generateStory: '生成故事',
    story: '故事',
    generating: '生成中…',
    generateAnimation: '生成动画',
    animation: '动画',
    processing: '处理中…',
    failed: '失败',
    animationN: '动画 {n}',
    selectVersionHint: '选择动画版本以继续',
    save: '保存',
    saveNext: '下一部分',
    storyPanel: {
      storyPreview: '故事预览',
      designRationale: '设计理念',
      soundDesign: '音效设计',
      generatingStory: '正在根据作品生成故事…',
      // 占位提示已隐藏；保留 key 以避免遗留组件触发 missing-key
      // 警告，但 Part3StoryPanel 的空状态不再渲染该行文字。
      uploadHint: '',
      part1Title: '第一部分：故事前半段',
      part2Title: '第二部分：互动选项',
      choicesHint: '请选择故事的走向：',
      part3Title: '第三部分：故事后半段',
      generatingCont: '正在生成续篇…',
      choosePathHint: '选择上方的路径，生成故事后半段。',
      ttsTitle: '故事朗读',
      ttsNoText: '请先生成故事以启用朗读功能。',
      ttsSegmentLabel: '朗读片段：',
      ttsSegmentPart1: '故事前半段',
      ttsSegmentPart3: '故事后半段',
      ttsPart3NotReady: '请先在「故事预览」中选择一条路径,生成后半段后再朗读。',
      ttsVoiceLabel: '选择声音：',
      ttsPlay: '播放',
      ttsPause: '暂停',
      ttsStop: '停止',
      ttsPlaying: '朗读中…',
      ttsPaused: '已暂停',
      ttsReady: '就绪',
      ttsLoading: '正在生成语音…',
      ttsBright: '活泼',
      ttsWarm: '温暖',
      ttsGentle: '温柔',
      ttsCrisp: '清爽',
      ttsDeep: '深沉',
      ttsNatural: '自然',
      // 2026-05：原 `aiSuggestionsTitle` + 故事 JSON 的 soundDesign
      // 字段已下线（视频模型不出音、教师反馈也不会真的采用），
      // 后端在生成故事时不再产出该字段，前端也不再渲染。Sound
      // Design tab 现在仅保留 TTS 朗读。
      // 设计理念 tab 里的 AI 协作对话框（2026-05 试点新增）。
      chatTitle: '与艺芽讨论修改',
      // 2026-05 文案微调 — 老师反馈"故事"太笼统，按钮也只能改前半段或选项，
      // 因此把示例改成与按钮一一对应的具体表述，引导老师写更精准的指令。
      chatHint: '可以说「把前半段故事修改得更贴近本课学习目标」，或「让三个互动选项更有想象力」。',
      // 客户端快速澄清（零 LLM 往返）— 当用户的修改指令未指明位置时，
      // 直接 push 这条本地 assistant 消息 + 4 个澄清芯片（或 Phase A 的 2 个），
      // 避免等待后端 4-8 秒推理。详见 stores/part3.ts 的 sendDesignChat 短路逻辑。
      chatClarifyLocal: '请问您想修改哪一部分呢？',
      chatPlaceholder: '说说想怎么改…',
      chatSend: '发送',
      chatSending: '思考中…',
      chatEmpty: '还没有对话。试试上面的提问示例，或直接问我任何关于这个故事的问题。',
      chatRevisedTitle: '修改后的故事',
      chatRevisedHint: '可以继续在下方追问微调，或点击「应用此版本」将「故事预览」替换为这版。',
      chatRevisedPart1: '第一部分：故事前半段',
      chatRevisedPart2: '第二部分：互动选项',
      chatRevisedPart3: '第三部分：故事后半段',
      // legacy — 2026-05 起"修改后的故事"卡片不再渲染设计理念段落
      // （后端也不再把 designRationale 纳入 revision_scope）。保留键以
      // 兼容历史聊天记录里旧 revised_story 数据。
      chatRevisedDesign: '设计理念',

      chatApply: '应用此版本',
      chatApplied: '已应用',
      chatViewStory: '查看「故事预览」 ›',
      chatStoryUpdated: '故事已更新',
    },
    // 第三部分右侧动画助手面板。标题复用
    // `chatbot.title`（创意助手）以保持品牌一致，所以这里只放
    // 问候语、建议词条与输入区文案。
    animationPanel: {
      // 2026-05 — 老师反馈：原 greeting 太"系统化"，对二年级老师不够
      // 引导性。新文案给出具体的提示词示例，帮老师建立"如何向 AI
      // 描述想要的动画"的心智模型。
      greeting: '每张插图有 3 次生成动画的机会。点击「生成动画」让我来为你创建适合这节课的动画内容，或在下方输入你想要的动画提示词，例如：让这张风景画活起来，让水流开始缓慢流动，树叶在风中轻轻摇晃，天空中的云朵慢慢变形。添加一两只小昆虫或小鸟在空中飞舞，增加趣味性，画面要温馨平和。',
      suggestionsLabel: '想要修改并重新生成吗？例如：',
      suggestions: [
        '让动画整体氛围更明亮欢快',
        '增加光影变化',
        '推近主体特写',
      ],
      acknowledge: '收到！正在根据你的调整生成新动画：「{prompt}」，可能需要一分钟…',
      generating: '正在生成动画…',
      noAttempts: '该图片已用完所有动画生成次数。',
      inputPlaceholder: '请输入想要调整的动画内容…',
    },
  },
  chatbot: {
    title: '创意助手',
    // `subtitle` is no longer rendered in the workspace chatbot
    // header (the title itself is now "创意助手"). Key kept for
    // forward compatibility with any future surface.
    subtitle: '创意助手',
    placeholder: '输入关于幻灯片设计的问题…',
    error: '抱歉，出现了错误，请重试。',
    // 兜底欢迎语 — 当无法解析 partId（例如 Part 3/6/7 这种有自己
    // 专用面板的 part，或 Sidebar 还没初始化好），fallback 给一组
    // 通用提示，避免出现空白。
    fallback: {
      greeting: '你好，我是 艺芽！有任何关于幻灯片设计的问题都可以问我，例如：',
      suggestions: [
        '这节课的学习目标是什么？',
        '这套幻灯片适合什么色调？',
        '如何把课件做得更吸引学生？',
      ],
    },
    // 2026-05 — 老师反馈：以前所有 Part 共用同一组开场白和初始
    // 选项，导致 AI 回答经常"泛泛而谈"。现在按 Part 1/2/4/5 各自的
    // 教学环节定制 greeting + 3 个 chips，每个问题都要求 AI 真的
    // 能给出有针对性的答案（避免"我在哪里找图"这种 AI 无法回答的
    // 系统层问题）。Part 3/6/7 走自己的右侧面板，不在此处。
    byPart: {
      1: {
        greeting:
          '你好，我是 艺芽！有任何关于课程导入页设计的问题都可以问我，例如：',
        suggestions: [
          '如何设计一个能吸引学生的课程导入页？',
          '课程导入页可以采用什么样的视觉元素和配色？',
          '怎样在导入页里抛出能激发学生好奇心的提问？',
        ],
      },
      2: {
        greeting:
          '你好，我是 艺芽！有任何关于新知讲授页设计的问题都可以问我，例如：',
        suggestions: [
          '这节课要重点讲授的艺术概念有哪些？',
          '怎样把核心知识点拆解成学生能理解的步骤？',
          '新知讲授页上文字、图片、示范画的比例怎么搭配？',
        ],
      },
      4: {
        greeting:
          '你好，我是 艺芽！有任何关于课堂实践页设计的问题都可以问我，例如：',
        suggestions: [
          '这节课的课堂实践活动可以怎样设计？',
          '实践环节需要哪些工具与材料准备？',
          '怎样在实践页上写清楚分步指令，让学生自己也能看懂？',
        ],
      },
      5: {
        greeting:
          '你好，我是 艺芽！有任何关于创意示范页设计的问题都可以问我，例如：',
        suggestions: [
          '老师演示创作过程时，最该突出哪些关键步骤？',
          '示范页上可以加入哪些细节，让学生看清创作要点？',
          '怎样用语言描述示范过程，引导学生跟着操作？',
        ],
      },
    },
  },

  // 第五部分 — 制作示例。默认嵌入 Bilibili 示范视频；
  // 2026-05-27 起恢复教师上传 / 粘贴链接的能力（见 Part5Content.vue 注释）。
  part5: {
    // 与侧栏 `sidebar.parts[4]` 保持一致（教学组 2026-05 提供）。
    slideTitle: '创意示范',
    upload: {
      localBtn: '上传本地视频',
      urlBtn: '粘贴视频链接',
      restoreBtn: '恢复默认视频',
      defaultLabel: '当前播放：默认示范视频',
      urlPlaceholder: '粘贴 Bilibili 链接、BV 号，或 mp4 直链',
      urlConfirm: '使用此链接',
      // 2026-05-29 — shown on the Part-5 canvas when the active
      // project has no curated default video AND the teacher hasn't
      // uploaded a custom one yet. Replaces the silent fallback to
      // 《好长好长》's Bilibili clip on blank "新建课件" projects.
      emptyHint: '本课件暂未设置创意示范视频。请使用下方按钮上传本地视频或粘贴 Bilibili / mp4 链接。',
    },
    errors: {
      notVideo: '请选择视频文件（mp4 / mov / webm）',
      tooLarge: '视频不能超过 200 MB',
      badUrl: '请输入有效的视频链接或 Bilibili BV 号',
    },
    toasts: {
      uploaded: '已替换为本地视频',
      urlSet: '已替换为指定链接',
      restored: '已恢复默认示范视频',
    },
  },

  part7: {
    noLessonTitle: '第七部分需要绑定教材课程',
    noLessonHint:
      '请从课件社区打开一节课（或新建一节）——第七部分会依据课程评价维度生成学生作品反馈。',
    studentWorks: '学生作品',
    studentWorksHint:
      '上传学生创作中或已完成的作品照片，点击缩略图即可生成针对性评价。',
    uploadLabel: '上传学生作品',
    removeWork: '移除该作品',
    selectWork: '请先在左侧选择一张学生作品。',
    studentNote: '学生备注（选填）',
    studentNotePh: '例如："兔子爬着长长的梯子去摘月亮。"',
    // 2026-05 — 老师反馈：用「获得作品点评」替代「生成 AI 评价」。
    // "点评" 一词更贴合美术老师评语的语义；"获得" 也比 "生成" 更
    // 像老师对自己的动作而非系统操作。
    generate: '获得作品点评',
    regenerate: '重新获得点评',
    generating: '生成中…',
    feedbackHeading: 'AI 评价',
    wordCount: '{n} 字',
    dimensionsCovered: '已覆盖维度：',
  },
  part6: {
    step1Label: '第一步：上传草稿或未完成的作品',

    uploadLabel: '上传学生作品',
    selectFiles: '选择文件',
    replace: '更换',
    step2Label: '第二步：选择一种风格，挖掘作品的潜力！',
    generatingStyles: '正在生成风格选项…',
    stylesHint: '与艺芽讨论确定适合本节课的艺术风格吧！',
    convertBtn: '开始转换！',
    allUsed: '所有风格均已使用，上传新作品重试。',
    // 2026-05 新增：当老师已在右侧聊天中确认了一套风格、但还没在 Step 1
    // 上传学生作品时，3 只小猪上方提示需要先完成上传。
    uploadFirst: '请先在上方上传学生作品后再开始转换。',
    // 2026-05 v2 — 老师预览 / 课堂模式 segmented toggle 与配套 toast。
    previewModeLabel: '老师预览',
    classroomModeLabel: '课堂模式',
    modeToggleAria: '选择老师预览或课堂模式',
    previewModeHint: '老师预览模式下，可反复测试每种风格，方便备课。',
    classroomModeHint: '已切换到课堂模式：每种风格只能转换一次。',
    teacherPreviewHint: '已切换到老师预览模式：可反复测试每种风格效果。',
    reopenDiscussion: '重新讨论风格',
    convertingOverlay: '转换中...',
    convertAgain: '再次转换',
    save: '保存',
    saveNext: '下一部分',
    // 2026-05 chat redesign — the panel now opens with a greeting +
    // 3 clickable intent chips. The bot already knows the lesson from
    // the LKP, so the teacher no longer needs to type a course
    // description. The legacy `sketchUploaded` / `stylesReady` /
    // `selectedStyleLabel` strings were retired with the old flow
    // but are kept here (commented above the new block) so any
    // dangling import in a partially-merged branch still resolves.
    bot: {
      greeting:
        '你好！我是 艺芽。让我们一起来设计这节课的个性化学生作品风格转换方案。你可以选择：',
      intents: {
        recommend: '为我推荐这节课的风格转换方案',
        skills: '告诉我这节课学生需要掌握什么创作技能',
        styles: '这节课重点学习的美术风格是什么',
      },
      confirmStyles: '确认这套风格',
      stylesConfirmed: '已确认 ✓',
      // 2026-05: 风格 chip 下方的「提示词预览」框 — 老师点击 chip
      // 后，该框展开显示对应风格的中文 prompt（95-105 字）。
      previewLabel: '提示词预览 · {name}',
      previewEmpty: '该风格暂无中文提示词。',
      errorChat: '抱歉，出了些问题，请重试。',
    },
  },
  teaching: {
    exit: '退出',
    prev: '上一页',
    next: '下一页',
  },
}
