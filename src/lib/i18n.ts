import { app, type AppLanguage } from "./stores/app.svelte";

type Dict = Record<string, string>;

const ru: Dict = {
  // ============================================================
  // COMMON / ACTIONS
  // ============================================================
  'common.cancel': 'Отмена',
  'common.insert': 'Вставить',
  'common.apply': 'Применить',
  'common.close': 'Закрыть',
  'common.reset': 'Сбросить настройки',
  'common.yes': 'Да',
  'common.no': 'Нет',
  'common.create': 'Создать',
  'common.remove': 'Удалить',
  'common.add': 'Добавить',
  'common.ok': 'ОК',
  'common.later': 'Позже',
  'common.restart': 'Перезапустить',
  'common.update': 'Обновить',

  'actions.undo': 'Отменить (Ctrl+Z)',
  'actions.redo': 'Повторить (Ctrl+Shift+Z)',
  'actions.openProject': 'Открыть презентацию (Ctrl+O)',
  'actions.newProject': 'Новая презентация',
  'actions.newProjectConfirm': 'Создать новую презентацию? Несохранённые изменения будут потеряны.',
  'actions.htmlEdit': 'HTML разметка',
  'actions.exportHtml': 'Экспорт HTML',
  'actions.exportPdf': 'Экспорт PDF',
  'actions.aiAssist': 'AI помощник',
  'actions.checkUpdates': 'Проверить обновления',

  // ============================================================
  // APP / SETTINGS / TOOLBAR
  // ============================================================
  'app.projectName': 'Имя презентации',
  'settings.transition': 'Переход',
  'settings.language': 'Язык',
  'toolbar.ai': 'ИИ',

  // ============================================================
  // SLIDES / VIEWPORT
  // ============================================================
  'slides.title': 'Слайды',
  'viewport.slide': 'Слайд',
  'viewport.delete': 'Удалить',
  'viewport.empty': 'Нет слайдов. Создайте первый слайд.',
  'viewport.resetView': 'Сбросить вид',
  'viewport.fitWidth': 'Двойной клик — подогнать по ширине',
  'viewport.fitHeight': 'Двойной клик — подогнать по высоте',

  // ============================================================
  // TOOLS
  // ============================================================
  'tools.title': 'Инструменты',
  'tools.text': 'Текст',
  'tools.image': 'Изображение',
  'tools.audio': 'Аудио',
  'tools.video': 'Видео',
  'tools.chart': 'Диаграмма',
  'tools.table': 'Таблица',
  'tools.shape': 'Фигура',
  'tools.transition': 'Переход слайда',
  'tools.transitionDuration': 'Длительность перехода (с)',
  'tools.tips': 'Подсказки',
  'tools.tipDrag': 'Перетаскивайте элементы мышью',
  'tools.tipDelete': 'Delete — удалить выбранное',
  'tools.tipPaste': 'Ctrl+V — вставить данные в таблицу',
  'tools.textInputDefaultText': 'Введите текст',

  // ============================================================
  // SHAPES
  // ============================================================
  'shapes.title': 'Выберите фигуру',
  'shapes.circle': 'Круг',
  'shapes.rect': 'Прямоугольник',
  'shapes.triangle': 'Треугольник',
  'shapes.star': 'Звезда',
  'shapes.arrow': 'Стрелка',
  'shapes.hexagon': 'Шестиугольник',
  'shapes.pentagon': 'Пятиугольник',
  'shapes.diamond': 'Ромб',
  'shapes.line': 'Линия',
  'shapes.operations': 'Операции',
  'shapes.union': 'Объединить',
  'shapes.subtract': 'Вычесть',
  'shapes.intersect': 'Пересечение',
  'shapes.exclude': 'Исключить',
  'shapes.mask': 'Маска',
  'shapes.applyMask': 'Применить как маску',
  'shapes.removeMask': 'Снять маску',
  'shapes.noMaskTarget': 'Нет объекта для маски',
  'shapes.emptyResult': 'Результат операции пуст',
  'shapes.selectOneShapeAndTarget': 'Выделите одну фигуру и один объект (Shift+клик)',
  'shapes.maskHint': 'Выделите фигуру и картинку/видео (Shift+клик), затем примените маску',
  'shape.fill': 'Заливка',
  'shape.swatches': 'Быстрые цвета',
  'shape.editHint': 'Двойной клик — редактировать точки',

  // ============================================================
  // TRANSITIONS
  // ============================================================
  'transitions.none': 'Без перехода',
  'transitions.fade': 'Плавное появление',
  'transitions.slideUp': 'Снизу вверх',
  'transitions.slideDown': 'Сверху вниз',
  'transitions.slideLeft': 'Справа налево',
  'transitions.slideRight': 'Слева направо',
  'transitions.zoomIn': 'Приближение',
  'transitions.zoomOut': 'Отдаление',
  'transitions.rotate': 'Поворот',
  'transitions.flip': 'Переворот',

  // ============================================================
  // AI
  // ============================================================
  'ai.title': 'AI помощник',
  'ai.provider': 'Провайдер',
  'ai.baseUrl': 'URL сервера',
  'ai.model': 'Модель',
  'ai.testConnection': 'Проверить соединение',
  'ai.connectionOk': 'Соединение установлено',
  'ai.connectionFailed': 'Ошибка соединения',
  'ai.prompt': 'Запрос',
  'ai.promptPlaceholder': 'Опишите презентацию: тема, ключевые идеи, структура...',
  'ai.hint': 'Ctrl+Enter — сгенерировать',
  'ai.slideCount': 'Количество слайдов',
  'ai.generateOne': 'Один слайд',
  'ai.generateAll': 'Создать {count} слайдов',
  'ai.promptTemplate': 'Промпт для нейросети',
  'ai.promptTemplateHint': 'Скопируйте и вставьте в любую нейросеть, затем вставьте ответ ниже.',
  'ai.copyPrompt': 'Скопировать промпт',
  'ai.copied': 'Скопировано',
  'ai.pasteResponse': 'Ответ нейросети',
  'ai.pasteResponseHint': 'Вставьте HTML-ответ и нажмите «Применить» — он заменит текущую презентацию.',
  'ai.applyPasted': 'Применить',
  'ai.slidesInserted': 'Вставлено слайдов: {count}',
  'ai.parseFailed': 'Не удалось распарсить ответ: {error}',
  'ai.noSlidesFound': 'В ответе не найдено ни одного слайда',
  'ai.slideCreated': 'Слайд создан',
  'ai.presentationCreated': 'Презентация создана: {count} слайдов',
  'ai.generationFailed': 'Ошибка: {error}',

  // ============================================================
  // TABLE
  // ============================================================
  'table.title': 'Редактор таблицы',
  'table.firstRowHeader': 'Первая строка — заголовки',
  'table.import': 'Импорт',
  'table.row': 'Строка',
  'table.col': 'Столбец',
  'table.removeRow': 'Удалить строку',
  'table.removeCol': 'Удалить столбец',
  'table.pasteHint': 'Совет: скопируйте диапазон из Excel и нажмите Ctrl+V в таблице',
  'table.emptyFile': 'Файл пустой',
  'table.importFailed': 'Ошибка импорта',
  'table.panelTitle': 'Настройки таблицы',
  'table.showHeader': 'Показывать заголовок',
  'table.headerBg': 'Фон заголовка',
  'table.headerColor': 'Цвет текста заголовка',
  'table.cellColor': 'Цвет текста ячеек',
  'table.borderColor': 'Цвет границ',
  'table.borderWidth': 'Толщина границ',
  'table.striped': 'Чередование строк',
  'table.stripeColor': 'Цвет чётных строк',
  'table.fontSize': 'Размер шрифта',
  'table.textAlign': 'Выравнивание',
  'table.paddingX': 'Отступ по горизонтали',
  'table.paddingY': 'Отступ по вертикали',
  'table.presets': 'Стили',
  'table.preset.default': 'По умолчанию',
  'table.preset.minimal': 'Минимал',
  'table.preset.striped': 'Полосы',
  'table.preset.bordered': 'Рамка',
  'table.preset.accent': 'Акцент',
  'table.preset.light': 'Светлая',
  'table.head1': 'Заголовок 1',
  'table.head2': 'Заголовок 2',
  'table.head3': 'Заголовок 3',

  // ============================================================
  // CHART
  // ============================================================
  'chart.title': 'Редактор диаграммы',
  'chart.kind': 'Тип',
  'chart.bar': 'Столбчатая',
  'chart.line': 'Линейная',
  'chart.pie': 'Круговая',
  'chart.doughnut': 'Кольцевая',
  'chart.dataset': 'Название серии',
  'chart.labels': 'Метки (по одной в строке)',
  'chart.values': 'Значения (по одному в строке)',
  'chart.mismatch': 'Количество меток и значений должно совпадать',
  'chart.importCsv': 'Импорт из CSV / Excel',
  'chart.style': 'Стиль диаграммы',
  'chart.colorFor': 'Цвет для «{label}»',
  'chart.label': 'Метка',
  'chart.value': 'Значение',
  'chart.addRow': 'Добавить',
  'chart.removeRow': 'Удалить',
  'chart.resetColors': 'Сбросить цвета',
  'chart.panelTitle': 'Настройки диаграммы',
  'chart.showDatasetLabel': 'Показывать название серии',
  'chart.datasetLabelColor': 'Цвет названия серии',
  'chart.datasetLabelSize': 'Размер названия серии',
  'chart.showLegend': 'Показывать легенду',
  'chart.legendColor': 'Цвет легенды',
  'chart.legendSize': 'Размер легенды',
  'chart.axisLabelColor': 'Цвет подписей осей',
  'chart.axisLabelSize': 'Размер подписей осей',
  'chart.gridColor': 'Цвет сетки',
  'chart.dataSection': 'Данные',
  'chart.appearanceSection': 'Вид',

  // ============================================================
  // EXPORT
  // ============================================================
  'export.folder': 'Папка экспорта',
  'export.pickFolder': 'Выбрать папку',
  'export.notSet': 'Не выбрана (будет запрошена при экспорте)',

  // ============================================================
  // TEXT PANEL
  // ============================================================
  'text.placeholder': 'Двойной клик для редактирования',
  'text.font': 'Шрифт',
  'text.style': 'Начертание',
  'text.size': 'Размер',
  'text.color': 'Цвет',
  'text.align': 'Выравнивание',
  'text.preview': 'Предпросмотр',
  'text.defaultFont': 'По умолчанию',
  'text.loadingFonts': 'Загрузка шрифтов...',

  // ============================================================
  // HTML EDITOR
  // ============================================================
  'htmlEditor.title': 'HTML разметка слайда',
  'htmlEditor.code': 'Код',
  'htmlEditor.preview': 'Предпросмотр',
  'htmlEditor.livePreview': 'Живой предпросмотр',
  'htmlEditor.format': 'Форматировать',
  'htmlEditor.resetSplit': 'Сбросить пропорцию панелей',
  'htmlEditor.dragToResize': 'Потяните, чтобы изменить ширину',
  'htmlEditor.unsaved': 'Есть несохранённые изменения',
  'htmlEditor.inSync': 'Синхронизировано',
  'htmlEditor.hint': 'Tab — отступ, Ctrl+S — применить, Esc — закрыть',

  // ============================================================
  // BACKGROUND
  // ============================================================
  'bg.title': 'Фон слайда',
  'bg.preset': 'Стиль',
  'bg.color': 'Цвет',
  'bg.image': 'Картинка',
  'bg.pickImage': 'Выбрать изображение',
  'bg.removeImage': 'Удалить изображение',
  'bg.imageFit': 'Заполнение',
  'bg.fitCover': 'Заполнить',
  'bg.fitContain': 'Вписать',
  'bg.fitRepeat': 'Повтор',
  'bg.presets.darkSolid': 'Тёмный',
  'bg.presets.lightSolid': 'Светлый',
  'bg.presets.purpleGradient': 'Фиолетовый градиент',
  'bg.presets.oceanGradient': 'Океан',
  'bg.presets.sunsetGradient': 'Закат',
  'bg.presets.forestGradient': 'Лес',
  'bg.presets.radialGlow': 'Свечение',
  'bg.presets.gridDark': 'Сетка',
  'bg.presets.dotsLight': 'Точки',
  'bg.presets.noiseDark': 'Шум',

  // ============================================================
  // EFFECTS
  // ============================================================
  'effects.title': 'Эффекты',
  'effects.dropShadow': 'Внешняя тень',
  'effects.innerShadow': 'Внутренняя тень',
  'effects.blur': 'Размытие',
  'effects.backdropBlur': 'Размытие фона',

  // ============================================================
  // TRANSFORM
  // ============================================================
  'transform.title': 'Трансформации',
  'transform.outline': 'Обводка',
  'transform.borderRadius': 'Скругление углов',
  'transform.cornerSmoothing': 'Сглаживание углов',
  'transform.cornerSmoothingHint': 'Squircle — как у иконок iOS',
  'transform.opacity': 'Прозрачность',
  'transform.blendMode': 'Режим наложения',
  'transform.rotation': 'Вращение',
  'transform.flip': 'Отражение',
  'transform.flipH': 'Отразить по горизонтали',
  'transform.flipV': 'Отразить по вертикали',

  // ============================================================
  // ALIGN
  // ============================================================
  'align.title': 'Выравнивание',
  'align.left': 'По левому краю',
  'align.center': 'По центру',
  'align.right': 'По правому краю',
  'align.top': 'По верху',
  'align.middle': 'По середине',
  'align.bottom': 'По низу',

  // ============================================================
  // BLEND MODES
  // ============================================================
  'blend.normal': 'Обычный',
  'blend.multiply': 'Умножение',
  'blend.screen': 'Экран',
  'blend.overlay': 'Перекрытие',
  'blend.darken': 'Замена тёмным',
  'blend.lighten': 'Замена светлым',
  'blend.colorDodge': 'Осветление основы',
  'blend.colorBurn': 'Затемнение основы',
  'blend.hardLight': 'Жёсткий свет',
  'blend.softLight': 'Мягкий свет',
  'blend.difference': 'Разница',
  'blend.exclusion': 'Исключение',

  // ============================================================
  // LAYERS
  // ============================================================
  'layers.title': 'Слои',
  'layers.empty': 'На слайде нет объектов',
  'layers.hide': 'Скрыть',
  'layers.show': 'Показать',
  'layers.lock': 'Заблокировать',
  'layers.unlock': 'Разблокировать',

  // ============================================================
  // ELEMENT TYPES
  // ============================================================
  'elementType.text': 'Текст',
  'elementType.image': 'Изображение',
  'elementType.audio': 'Аудио',
  'elementType.video': 'Видео',
  'elementType.chart': 'Диаграмма',
  'elementType.table': 'Таблица',
  'elementType.shape': 'Фигура',

  // ============================================================
  // ANIMATION
  // ============================================================
  'anim.title': 'Анимация',
  'anim.add': 'Добавить анимацию',
  'anim.kind': 'Тип',
  'anim.trigger': 'Триггер',
  'anim.trigger.onClick': 'По щелчку',
  'anim.trigger.withPrevious': 'С предыдущим',
  'anim.trigger.afterPrevious': 'После предыдущего',
  'anim.duration': 'Длительность',
  'anim.delay': 'Задержка',
  'anim.easing.title': 'Сглаживание',
  'anim.easing.ease': 'Плавно',
  'anim.easing.easeIn': 'Ускорение',
  'anim.easing.easeOut': 'Замедление',
  'anim.easing.easeInOut': 'Плавно туда-обратно',
  'anim.easing.linear': 'Линейно',
  'anim.easing.spring': 'Пружина',
  'anim.preview': 'Предпросмотр',
  'anim.remove': 'Удалить анимацию',
  'anim.none': 'Без анимации',
  'anim.fade': 'Появление',
  'anim.slideUp': 'Выезд снизу',
  'anim.slideDown': 'Выезд сверху',
  'anim.slideLeft': 'Выезд справа',
  'anim.slideRight': 'Выезд слева',
  'anim.zoomIn': 'Увеличение',
  'anim.zoomOut': 'Уменьшение',
  'anim.rotate': 'Вращение',
  'anim.flip': 'Переворот',
  'anim.bounce': 'Отскок',
  'anim.spin': 'Закрутка',
  'anim.wipeLeft': 'Шторка слева',
  'anim.wipeRight': 'Шторка справа',
  'anim.wipeUp': 'Шторка снизу',
  'anim.wipeDown': 'Шторка сверху',
  'anim.grow': 'Рост из точки',
  'anim.shrink': 'Сжатие',
  'anim.drop': 'Падение',
  'anim.rise': 'Подъём',
  'anim.pulse': 'Пульс',

  // ============================================================
  // AUDIO
  // ============================================================
  'audio.title': 'Аудио',
  'audio.autoplay': 'Автовоспроизведение',
  'audio.playOnClick': 'По щелчку',
  'audio.loop': 'Зациклить',
  'audio.hideControls': 'Скрыть плеер',
  'audio.stopOnSlideLeave': 'Останавливать при уходе со слайда',
  'audio.volume': 'Громкость',
  'audio.startTime': 'Начало (сек)',
  'audio.endTime': 'Конец (сек)',
  'audio.endTimeHint': '0 — играть до конца',
  'audio.playerStyle': 'Вид плеера',
  'audio.style.minimal': 'Минимальный',
  'audio.style.compact': 'Компактный',
  'audio.style.full': 'Полный',
  'audio.range': 'Диапазон воспроизведения',
  'audio.rangeHint': 'Перетащите ползунки, чтобы выбрать начало и конец',

  // ============================================================
  // VIDEO
  // ============================================================
  'video.title': 'Видео',
  'video.sourceFile': 'Файл',
  'video.sourceEmbed': 'Ссылка',
  'video.pickFile': 'Выбрать видео с компьютера',
  'video.embedUrl': 'Ссылка на видео',
  'video.embedEmpty': 'Введите ссылку',
  'video.embedInvalid': 'Это не embed-ссылка. Откройте видео на сайте провайдера и используйте «Поделиться» → «Встроить».',
  'video.embedHint': 'Вставьте embed-ссылку: YouTube — «Поделиться» → «Встроить»; VK — «Поделиться» → «Встроить»; Rutube — «Поделиться» → «Встроить».',
  'video.providerDetected': 'Определён сервис',
  'video.autoplay': 'Автовоспроизведение',
  'video.loop': 'Зациклить',
  'video.muted': 'Без звука',
  'video.controls': 'Показывать элементы управления',
  'video.playOnClick': 'По щелчку',
  'video.stopOnSlideLeave': 'Останавливать при уходе со слайда',
  'video.volume': 'Громкость',
  'video.range': 'Диапазон',
  'video.startTime': 'Начало (сек)',
  'video.endTime': 'Конец (сек)',
  'video.playerStyle': 'Вид плеера',
  'video.style.minimal': 'Минимальный',
  'video.style.compact': 'Компактный',
  'video.style.full': 'Полный',

  // ============================================================
  // TOASTS
  // ============================================================
  'toast.noSlides': 'Сначала создайте хотя бы один слайд',
  'toast.exported': 'Экспорт завершён',
  'toast.exportFailed': 'Ошибка экспорта',
  'toast.exportedTo': 'Экспортировано в {path} (файлов: {count})',
  'toast.exportCancelled': 'Экспорт отменён',
  'toast.dropAdded': 'Добавлено: {name}',
  'toast.dropUnsupported': 'Неподдерживаемый тип файла: {name}',
  'toast.dropEmptyFile': 'Файл пустой: {name}',
  'toast.dropImportFailed': 'Не удалось импортировать {name}: {error}',
  'toast.pasteUnsupported': 'Неподдерживаемый тип файла: {name}',
  'toast.pasteText': 'Текст добавлен',
  'toast.projectOpened': 'Открыта презентация «{name}»',
  'toast.projectOpenFailed': 'Не удалось открыть презентацию',
  'toast.projectReset': 'Создана новая презентация',
  'toast.mediaAdded': 'Добавлено: {name}',
  'toast.tableAdded': 'Таблица добавлена',
  'toast.chartAdded': 'Диаграмма добавлена',
  'toast.shapeMerged': 'Фигуры объединены',
  'toast.maskApplied': 'Маска применена',
  'toast.maskRemoved': 'Маска снята',
  'toast.shapeAdded': 'Фигура добавлена',
  'toast.videoCodecUnsupported': 'Видео «{name}» использует неподдерживаемый кодек. Перекодируйте в H.264 (Main Profile, 8-бит).',
  'toast.videoUnsupported': 'Формат видео «{name}» не поддерживается. Используйте MP4 с кодеком H.264.',
  'toast.videoError': 'Ошибка воспроизведения «{name}» (код {code}).',
  'toast.upToDate': 'Установлена последняя версия',
  'toast.updateAvailable': 'Доступна версия {version} (текущая: {current})',
  'toast.updateDownloading': 'Скачивание обновления...',
  'toast.updateReadyRestart': 'Обновление установлено. Перезапустить сейчас?',
  'toast.updateFailed': 'Ошибка обновления',

  'shortcuts.nudge': 'сдвинуть на 1px',
  'shortcuts.nudgeFast': 'сдвинуть на 10px',
  'shortcuts.drag': 'перетаскивание мышью',
  'shortcuts.dragAxis': 'движение по одной оси',
  'shortcuts.resize': 'ресайз',
  'shortcuts.resizeProportional': 'сохранить пропорции',
  'shortcuts.rotate': 'вращение',
  'shortcuts.rotateSnap': 'шаг 15°',
  'shortcuts.delete': 'удалить выбранное',
  'shortcuts.deselect': 'снять выделение',
  'shortcuts.pan': 'панорамирование',
  'shortcuts.wheel': 'колесо',
  'shortcuts.zoom': 'зум холста',
  'shortcuts.undo': 'отменить',
  'shortcuts.redo': 'повторить',
  'shortcuts.open': 'открыть презентацию',
  'shortcuts.paste': 'вставить файл / текст / данные',
  'shortcuts.exportHtml': 'экспорт HTML',
  'shortcuts.exportPdf': 'экспорт PDF',
  'shortcuts.preview': 'предпросмотр',
  'shortcuts.previewCurrent': 'предпросмотр с текущего слайда',
};

const en: Dict = {
  // ============================================================
  // COMMON / ACTIONS
  // ============================================================
  'common.cancel': 'Cancel',
  'common.insert': 'Insert',
  'common.apply': 'Apply',
  'common.close': 'Close',
  'common.reset': 'Reset settings',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.create': 'Create',
  'common.remove': 'Remove',
  'common.add': 'Add',
  'common.ok': 'OK',
  'common.later': 'Later',
  'common.restart': 'Restart',
  'common.update': 'Update',

  'actions.undo': 'Undo (Ctrl+Z)',
  'actions.redo': 'Redo (Ctrl+Shift+Z)',
  'actions.openProject': 'Open presentation (Ctrl+O)',
  'actions.newProject': 'New presentation',
  'actions.newProjectConfirm': 'Create a new presentation? Unsaved changes will be lost.',
  'actions.htmlEdit': 'HTML Markup',
  'actions.exportHtml': 'Export HTML',
  'actions.exportPdf': 'Export PDF',
  'actions.aiAssist': 'AI Assistant',
  'actions.checkUpdates': 'Check for updates',

  // ============================================================
  // APP / SETTINGS / TOOLBAR
  // ============================================================
  'app.projectName': 'Presentation name',
  'settings.transition': 'Transition',
  'settings.language': 'Language',
  'toolbar.ai': 'AI',

  // ============================================================
  // SLIDES / VIEWPORT
  // ============================================================
  'slides.title': 'Slides',
  'viewport.slide': 'Slide',
  'viewport.delete': 'Delete',
  'viewport.empty': 'No slides yet. Create your first slide.',
  'viewport.resetView': 'Reset view',
  'viewport.fitWidth': 'Double-click to fit width',
  'viewport.fitHeight': 'Double-click to fit height',

  // ============================================================
  // TOOLS
  // ============================================================
  'tools.title': 'Tools',
  'tools.text': 'Text',
  'tools.image': 'Image',
  'tools.audio': 'Audio',
  'tools.video': 'Video',
  'tools.chart': 'Chart',
  'tools.table': 'Table',
  'tools.shape': 'Shape',
  'tools.transition': 'Slide transition',
  'tools.transitionDuration': 'Transition duration (s)',
  'tools.tips': 'Tips',
  'tools.tipDrag': 'Drag elements with the mouse',
  'tools.tipDelete': 'Delete — remove selection',
  'tools.tipPaste': 'Ctrl+V — paste data into table',
  'tools.textInputDefaultText': 'Enter the text',

  // ============================================================
  // SHAPES
  // ============================================================
  'shapes.title': 'Choose a shape',
  'shapes.circle': 'Circle',
  'shapes.rect': 'Rectangle',
  'shapes.triangle': 'Triangle',
  'shapes.star': 'Star',
  'shapes.arrow': 'Arrow',
  'shapes.hexagon': 'Hexagon',
  'shapes.pentagon': 'Pentagon',
  'shapes.diamond': 'Diamond',
  'shapes.line': 'Line',
  'shapes.operations': 'Operations',
  'shapes.union': 'Union',
  'shapes.subtract': 'Subtract',
  'shapes.intersect': 'Intersect',
  'shapes.exclude': 'Exclude',
  'shapes.mask': 'Mask',
  'shapes.applyMask': 'Apply as mask',
  'shapes.removeMask': 'Remove mask',
  'shapes.noMaskTarget': 'No object to mask',
  'shapes.emptyResult': 'Operation result is empty',
  'shapes.selectOneShapeAndTarget': 'Select one shape and one target (Shift+click)',
  'shapes.maskHint': 'Select a shape and an image/video (Shift+click), then apply the mask',
  'shape.fill': 'Fill',
  'shape.swatches': 'Quick colors',
  'shape.editHint': 'Double-click to edit points',

  // ============================================================
  // TRANSITIONS
  // ============================================================
  'transitions.none': 'None',
  'transitions.fade': 'Fade',
  'transitions.slideUp': 'Slide up',
  'transitions.slideDown': 'Slide down',
  'transitions.slideLeft': 'Slide left',
  'transitions.slideRight': 'Slide right',
  'transitions.zoomIn': 'Zoom in',
  'transitions.zoomOut': 'Zoom out',
  'transitions.rotate': 'Rotate',
  'transitions.flip': 'Flip',

  // ============================================================
  // AI
  // ============================================================
  'ai.title': 'AI Assistant',
  'ai.provider': 'Provider',
  'ai.baseUrl': 'Server URL',
  'ai.model': 'Model',
  'ai.testConnection': 'Test connection',
  'ai.connectionOk': 'Connection OK',
  'ai.connectionFailed': 'Connection failed',
  'ai.prompt': 'Prompt',
  'ai.promptPlaceholder': 'Describe the presentation: topic, key ideas, structure...',
  'ai.hint': 'Ctrl+Enter — generate',
  'ai.slideCount': 'Slide count',
  'ai.generateOne': 'One slide',
  'ai.generateAll': 'Create {count} slides',
  'ai.promptTemplate': 'Prompt for the AI',
  'ai.promptTemplateHint': 'Copy and paste into any AI, then paste the response below.',
  'ai.copyPrompt': 'Copy prompt',
  'ai.copied': 'Copied',
  'ai.pasteResponse': 'AI response',
  'ai.pasteResponseHint': 'Paste HTML response and click Apply — it will replace the current presentation.',
  'ai.applyPasted': 'Apply',
  'ai.slidesInserted': 'Inserted slides: {count}',
  'ai.parseFailed': 'Failed to parse response: {error}',
  'ai.noSlidesFound': 'No slides found in response',
  'ai.slideCreated': 'Slide created',
  'ai.presentationCreated': 'Presentation created: {count} slides',
  'ai.generationFailed': 'Error: {error}',

  // ============================================================
  // TABLE
  // ============================================================
  'table.title': 'Table editor',
  'table.firstRowHeader': 'First row is header',
  'table.import': 'Import',
  'table.row': 'Row',
  'table.col': 'Column',
  'table.removeRow': 'Remove row',
  'table.removeCol': 'Remove column',
  'table.pasteHint': 'Tip: copy a range from Excel and press Ctrl+V in the table',
  'table.emptyFile': 'File is empty',
  'table.importFailed': 'Import failed',
  'table.panelTitle': 'Table settings',
  'table.showHeader': 'Show header',
  'table.headerBg': 'Header background',
  'table.headerColor': 'Header text color',
  'table.cellColor': 'Cell text color',
  'table.borderColor': 'Border color',
  'table.borderWidth': 'Border width',
  'table.striped': 'Striped rows',
  'table.stripeColor': 'Stripe color',
  'table.fontSize': 'Font size',
  'table.textAlign': 'Text align',
  'table.paddingX': 'Horizontal padding',
  'table.paddingY': 'Vertical padding',
  'table.presets': 'Styles',
  'table.preset.default': 'Default',
  'table.preset.minimal': 'Minimal',
  'table.preset.striped': 'Striped',
  'table.preset.bordered': 'Bordered',
  'table.preset.accent': 'Accent',
  'table.preset.light': 'Light',
  'table.head1': 'Heading 1',
  'table.head2': 'Heading 2',
  'table.head3': 'Heading 3',

  // ============================================================
  // CHART
  // ============================================================
  'chart.title': 'Chart editor',
  'chart.kind': 'Type',
  'chart.bar': 'Bar',
  'chart.line': 'Line',
  'chart.pie': 'Pie',
  'chart.doughnut': 'Doughnut',
  'chart.dataset': 'Dataset name',
  'chart.labels': 'Labels (one per line)',
  'chart.values': 'Values (one per line)',
  'chart.mismatch': 'Number of labels and values must match',
  'chart.importCsv': 'Import from CSV / Excel',
  'chart.style': 'Chart style',
  'chart.colorFor': 'Color for "{label}"',
  'chart.label': 'Label',
  'chart.value': 'Value',
  'chart.addRow': 'Add',
  'chart.removeRow': 'Remove',
  'chart.resetColors': 'Reset colors',
  'chart.panelTitle': 'Chart settings',
  'chart.showDatasetLabel': 'Show dataset label',
  'chart.datasetLabelColor': 'Dataset label color',
  'chart.datasetLabelSize': 'Dataset label size',
  'chart.showLegend': 'Show legend',
  'chart.legendColor': 'Legend color',
  'chart.legendSize': 'Legend size',
  'chart.axisLabelColor': 'Axis label color',
  'chart.axisLabelSize': 'Axis label size',
  'chart.gridColor': 'Grid color',
  'chart.dataSection': 'Data',
  'chart.appearanceSection': 'Appearance',

  // ============================================================
  // EXPORT
  // ============================================================
  'export.folder': 'Export folder',
  'export.pickFolder': 'Choose folder',
  'export.notSet': 'Not set (will be asked on export)',

  // ============================================================
  // TEXT PANEL
  // ============================================================
  'text.placeholder': 'Double-click to edit',
  'text.font': 'Font',
  'text.style': 'Style',
  'text.size': 'Size',
  'text.color': 'Color',
  'text.align': 'Align',
  'text.preview': 'Preview',
  'text.defaultFont': 'Default',
  'text.loadingFonts': 'Loading fonts...',

  // ============================================================
  // HTML EDITOR
  // ============================================================
  'htmlEditor.title': 'Slide HTML markup',
  'htmlEditor.code': 'Code',
  'htmlEditor.preview': 'Preview',
  'htmlEditor.livePreview': 'Live preview',
  'htmlEditor.format': 'Format',
  'htmlEditor.resetSplit': 'Reset panel sizes',
  'htmlEditor.dragToResize': 'Drag to resize',
  'htmlEditor.unsaved': 'Unsaved changes',
  'htmlEditor.inSync': 'In sync',
  'htmlEditor.hint': 'Tab — indent, Ctrl+S — apply, Esc — close',

  // ============================================================
  // BACKGROUND
  // ============================================================
  'bg.title': 'Slide background',
  'bg.preset': 'Preset',
  'bg.color': 'Color',
  'bg.image': 'Image',
  'bg.pickImage': 'Choose image',
  'bg.removeImage': 'Remove image',
  'bg.imageFit': 'Fit',
  'bg.fitCover': 'Cover',
  'bg.fitContain': 'Contain',
  'bg.fitRepeat': 'Repeat',
  'bg.presets.darkSolid': 'Dark',
  'bg.presets.lightSolid': 'Light',
  'bg.presets.purpleGradient': 'Purple gradient',
  'bg.presets.oceanGradient': 'Ocean',
  'bg.presets.sunsetGradient': 'Sunset',
  'bg.presets.forestGradient': 'Forest',
  'bg.presets.radialGlow': 'Glow',
  'bg.presets.gridDark': 'Grid',
  'bg.presets.dotsLight': 'Dots',
  'bg.presets.noiseDark': 'Noise',

  // ============================================================
  // EFFECTS
  // ============================================================
  'effects.title': 'Effects',
  'effects.dropShadow': 'Drop shadow',
  'effects.innerShadow': 'Inner shadow',
  'effects.blur': 'Blur',
  'effects.backdropBlur': 'Backdrop blur',

  // ============================================================
  // TRANSFORM
  // ============================================================
  'transform.title': 'Transform',
  'transform.outline': 'Outline',
  'transform.borderRadius': 'Corner radius',
  'transform.cornerSmoothing': 'Corner smoothing',
  'transform.cornerSmoothingHint': 'Squircle — like iOS icons',
  'transform.opacity': 'Opacity',
  'transform.blendMode': 'Blend mode',
  'transform.rotation': 'Rotation',
  'transform.flip': 'Flip',
  'transform.flipH': 'Flip horizontal',
  'transform.flipV': 'Flip vertical',

  // ============================================================
  // ALIGN
  // ============================================================
  'align.title': 'Alignment',
  'align.left': 'Align left',
  'align.center': 'Align center',
  'align.right': 'Align right',
  'align.top': 'Align top',
  'align.middle': 'Align middle',
  'align.bottom': 'Align bottom',

  // ============================================================
  // BLEND MODES
  // ============================================================
  'blend.normal': 'Normal',
  'blend.multiply': 'Multiply',
  'blend.screen': 'Screen',
  'blend.overlay': 'Overlay',
  'blend.darken': 'Darken',
  'blend.lighten': 'Lighten',
  'blend.colorDodge': 'Color dodge',
  'blend.colorBurn': 'Color burn',
  'blend.hardLight': 'Hard light',
  'blend.softLight': 'Soft light',
  'blend.difference': 'Difference',
  'blend.exclusion': 'Exclusion',

  // ============================================================
  // LAYERS
  // ============================================================
  'layers.title': 'Layers',
  'layers.empty': 'No objects on this slide',
  'layers.hide': 'Hide',
  'layers.show': 'Show',
  'layers.lock': 'Lock',
  'layers.unlock': 'Unlock',

  // ============================================================
  // ELEMENT TYPES
  // ============================================================
  'elementType.text': 'Text',
  'elementType.image': 'Image',
  'elementType.audio': 'Audio',
  'elementType.video': 'Video',
  'elementType.chart': 'Chart',
  'elementType.table': 'Table',
  'elementType.shape': 'Shape',

  // ============================================================
  // ANIMATION
  // ============================================================
  'anim.title': 'Animation',
  'anim.add': 'Add animation',
  'anim.kind': 'Type',
  'anim.trigger': 'Trigger',
  'anim.trigger.onClick': 'On click',
  'anim.trigger.withPrevious': 'With previous',
  'anim.trigger.afterPrevious': 'After previous',
  'anim.duration': 'Duration',
  'anim.delay': 'Delay',
  'anim.easing.title': 'Easing',
  'anim.easing.ease': 'Ease',
  'anim.easing.easeIn': 'Ease in',
  'anim.easing.easeOut': 'Ease out',
  'anim.easing.easeInOut': 'Ease in-out',
  'anim.easing.linear': 'Linear',
  'anim.easing.spring': 'Spring',
  'anim.preview': 'Preview',
  'anim.remove': 'Remove animation',
  'anim.none': 'No animation',
  'anim.fade': 'Fade in',
  'anim.slideUp': 'Slide up',
  'anim.slideDown': 'Slide down',
  'anim.slideLeft': 'Slide left',
  'anim.slideRight': 'Slide right',
  'anim.zoomIn': 'Zoom in',
  'anim.zoomOut': 'Zoom out',
  'anim.rotate': 'Rotate',
  'anim.flip': 'Flip',
  'anim.bounce': 'Bounce',
  'anim.spin': 'Spin',
  'anim.wipeLeft': 'Wipe left',
  'anim.wipeRight': 'Wipe right',
  'anim.wipeUp': 'Wipe up',
  'anim.wipeDown': 'Wipe down',
  'anim.grow': 'Grow from point',
  'anim.shrink': 'Shrink',
  'anim.drop': 'Drop',
  'anim.rise': 'Rise',
  'anim.pulse': 'Pulse',

  // ============================================================
  // AUDIO
  // ============================================================
  'audio.title': 'Audio',
  'audio.autoplay': 'Autoplay',
  'audio.playOnClick': 'Play on click',
  'audio.loop': 'Loop',
  'audio.hideControls': 'Hide player',
  'audio.stopOnSlideLeave': 'Stop on slide leave',
  'audio.volume': 'Volume',
  'audio.startTime': 'Start (sec)',
  'audio.endTime': 'End (sec)',
  'audio.endTimeHint': '0 — play to the end',
  'audio.playerStyle': 'Player style',
  'audio.style.minimal': 'Minimal',
  'audio.style.compact': 'Compact',
  'audio.style.full': 'Full',
  'audio.range': 'Playback range',
  'audio.rangeHint': 'Drag handles to set start and end',

  // ============================================================
  // VIDEO
  // ============================================================
  'video.title': 'Video',
  'video.sourceFile': 'File',
  'video.sourceEmbed': 'Link',
  'video.pickFile': 'Choose video from computer',
  'video.embedUrl': 'Video URL',
  'video.embedEmpty': 'Enter a URL',
  'video.embedInvalid': 'This is not an embed URL. Open the video on the provider site and use Share → Embed.',
  'video.embedHint': 'Paste an embed URL: YouTube — Share → Embed; VK — Share → Embed; Rutube — Share → Embed.',
  'video.providerDetected': 'Detected provider',
  'video.autoplay': 'Autoplay',
  'video.loop': 'Loop',
  'video.muted': 'Muted',
  'video.controls': 'Show controls',
  'video.playOnClick': 'Play on click',
  'video.stopOnSlideLeave': 'Stop on slide leave',
  'video.volume': 'Volume',
  'video.range': 'Range',
  'video.startTime': 'Start (sec)',
  'video.endTime': 'End (sec)',
  'video.playerStyle': 'Player style',
  'video.style.minimal': 'Minimal',
  'video.style.compact': 'Compact',
  'video.style.full': 'Full',

  // ============================================================
  // TOASTS
  // ============================================================
  'toast.noSlides': 'Create at least one slide first',
  'toast.exported': 'Export completed',
  'toast.exportFailed': 'Export failed',
  'toast.exportedTo': 'Exported to {path} (files: {count})',
  'toast.exportCancelled': 'Export cancelled',
  'toast.dropAdded': 'Added: {name}',
  'toast.dropUnsupported': 'Unsupported file type: {name}',
  'toast.dropEmptyFile': 'File is empty: {name}',
  'toast.dropImportFailed': 'Failed to import {name}: {error}',
  'toast.pasteUnsupported': 'Unsupported file type: {name}',
  'toast.pasteText': 'Text added',
  'toast.projectOpened': 'Opened presentation "{name}"',
  'toast.projectOpenFailed': 'Failed to open presentation',
  'toast.projectReset': 'New presentation created',
  'toast.mediaAdded': 'Added: {name}',
  'toast.tableAdded': 'Table added',
  'toast.chartAdded': 'Chart added',
  'toast.shapeMerged': 'Shapes merged',
  'toast.maskApplied': 'Mask applied',
  'toast.maskRemoved': 'Mask removed',
  'toast.shapeAdded': 'Shape added',
  'toast.videoCodecUnsupported': 'Video "{name}" uses an unsupported codec. Re-encode to H.264 (Main Profile, 8-bit).',
  'toast.videoUnsupported': 'Video format "{name}" is not supported. Use MP4 with H.264 codec.',
  'toast.videoError': 'Playback error for "{name}" (code {code}).',
  'toast.upToDate': 'You are on the latest version',
  'toast.updateAvailable': 'Version {version} available (current: {current})',
  'toast.updateDownloading': 'Downloading update...',
  'toast.updateReadyRestart': 'Update installed. Restart now?',
  'toast.updateFailed': 'Update failed',

  'shortcuts.nudge': 'nudge by 1px',
  'shortcuts.nudgeFast': 'nudge by 10px',
  'shortcuts.drag': 'mouse drag',
  'shortcuts.dragAxis': 'move along one axis',
  'shortcuts.resize': 'resize',
  'shortcuts.resizeProportional': 'keep proportions',
  'shortcuts.rotate': 'rotate',
  'shortcuts.rotateSnap': 'snap to 15°',
  'shortcuts.delete': 'delete selection',
  'shortcuts.deselect': 'deselect',
  'shortcuts.pan': 'pan canvas',
  'shortcuts.wheel': 'wheel',
  'shortcuts.zoom': 'zoom canvas',
  'shortcuts.undo': 'undo',
  'shortcuts.redo': 'redo',
  'shortcuts.open': 'open presentation',
  'shortcuts.paste': 'paste file / text / data',
  'shortcuts.exportHtml': 'export HTML',
  'shortcuts.exportPdf': 'export PDF',
  'shortcuts.preview': 'preview',
  'shortcuts.previewCurrent': 'preview from the current slide',
};

const dictionaries: Record<AppLanguage, Dict> = { ru, en };

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[app.language] ?? ru;
  let str = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
