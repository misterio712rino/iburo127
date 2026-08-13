import type { ClientQuestionnaireSeed, QuestionnaireAnswers, QuestionnaireSection } from "../types";

const yesNo = ["Да", "Нет"] as const;

export const QUESTIONNAIRE_SECTIONS: readonly QuestionnaireSection[] = [
  { id: "basics", number: 1, title: "Основные сведения", description: "Начнём с информации, которая идентифицирует заявителя.", fields: [
    { id: "fullName", label: "ФИО", type: "text", required: true, placeholder: "Фамилия Имя Отчество" },
    { id: "birthDate", label: "Дата рождения", type: "date", required: true },
    { id: "city", label: "Город проживания", type: "text", required: true, placeholder: "Например, Москва" },
    { id: "maritalStatus", label: "Семейное положение", type: "select", required: true, options: ["Не состою в браке", "Состою в браке", "Разведён(а)", "Вдовец / вдова"] },
  ]},
  { id: "family", number: 2, title: "Семья", description: "Семейные обстоятельства учитываются при подготовке материалов дела.", fields: [
    { id: "hasSpouse", label: "Есть супруг или супруга?", type: "yes-no", required: true, options: yesNo },
    { id: "spouseName", label: "ФИО супруга или супруги", type: "text", visibleWhen: { fieldId: "hasSpouse", equals: true } },
    { id: "childrenCount", label: "Количество детей", type: "number", required: true },
    { id: "hasDependents", label: "Есть другие иждивенцы?", type: "yes-no", required: true, options: yesNo },
  ]},
  { id: "income", number: 3, title: "Доходы", description: "Укажите регулярные поступления без детального расчёта налогов.", fields: [
    { id: "incomeSource", label: "Основной источник дохода", type: "select", required: true, options: ["Работа по найму", "Самозанятость", "Предпринимательство", "Пенсия", "Временно без дохода"] },
    { id: "monthlyIncome", label: "Среднемесячный доход", type: "currency", required: true, placeholder: "₽" },
    { id: "officialIncome", label: "Доход официальный?", type: "yes-no", required: true, options: yesNo },
    { id: "additionalIncome", label: "Есть дополнительные доходы?", type: "yes-no", required: true, options: yesNo },
  ]},
  { id: "debts", number: 4, title: "Обязательства и кредиторы", description: "Достаточно ориентировочных данных — точные суммы можно уточнить позднее.", fields: [
    { id: "creditorCount", label: "Примерное количество кредиторов", type: "number", required: true },
    { id: "totalDebt", label: "Общая сумма задолженности", type: "currency", required: true, placeholder: "₽" },
    { id: "hasOverdue", label: "Есть просрочки?", type: "yes-no", required: true, options: yesNo },
    { id: "hasEnforcement", label: "Есть исполнительные производства?", type: "yes-no", required: true, options: yesNo },
  ]},
  { id: "property", number: 5, title: "Имущество", description: "Отметьте категории имущества — детали появятся только при необходимости.", fields: [
    { id: "hasRealEstate", label: "Есть недвижимость?", type: "yes-no", required: true, options: yesNo },
    { id: "hasVehicle", label: "Есть автомобиль или другой транспорт?", type: "yes-no", required: true, options: yesNo },
    { id: "hasValuables", label: "Есть другое ценное имущество?", type: "yes-no", required: true, options: yesNo },
    { id: "valuablesNote", label: "Кратко опишите имущество", type: "textarea", visibleWhen: { fieldId: "hasValuables", equals: true } },
  ]},
  { id: "real-estate", number: 6, title: "Недвижимость", description: "Сведения нужны для последующего анализа специалистом.", fields: [
    { id: "realEstateType", label: "Тип объекта", type: "select", required: true, options: ["Квартира", "Дом", "Земельный участок", "Коммерческая недвижимость"] },
    { id: "ownershipShare", label: "Доля собственности", type: "text", required: true, placeholder: "Например, 1/1 или 1/2" },
    { id: "realEstateValue", label: "Ориентировочная стоимость", type: "currency", required: true },
    { id: "onlyHousing", label: "Это единственное жильё?", type: "yes-no", required: true, options: yesNo },
    { id: "hasMortgage", label: "Объект находится в ипотеке?", type: "yes-no", required: true, options: yesNo },
  ]},
  { id: "mortgage", number: 7, title: "Ипотека", description: "Условия ипотеки требуют отдельного внимательного анализа.", fields: [
    { id: "mortgageBank", label: "Банк", type: "text", required: true, visibleWhen: { fieldId: "hasMortgage", equals: true } },
    { id: "mortgageBalance", label: "Остаток долга", type: "currency", required: true, visibleWhen: { fieldId: "hasMortgage", equals: true } },
    { id: "mortgagePayment", label: "Ежемесячный платёж", type: "currency", required: true, visibleWhen: { fieldId: "hasMortgage", equals: true } },
  ]},
  { id: "transport", number: 8, title: "Транспорт", description: "Если транспорта нет, раздел будет отмечен как неприменимый.", fields: [
    { id: "vehicleModel", label: "Марка и модель", type: "text", required: true, visibleWhen: { fieldId: "hasVehicle", equals: true } },
    { id: "vehicleYear", label: "Год выпуска", type: "number", required: true, visibleWhen: { fieldId: "hasVehicle", equals: true } },
    { id: "vehicleValue", label: "Примерная стоимость", type: "currency", required: true, visibleWhen: { fieldId: "hasVehicle", equals: true } },
  ]},
  { id: "transactions", number: 9, title: "Сделки", description: "Сообщите о значимых сделках за последние годы.", fields: [
    { id: "hasMajorDeals", label: "Были крупные сделки?", type: "yes-no", required: true, options: yesNo },
    { id: "soldRealEstate", label: "Продавали недвижимость?", type: "yes-no", required: true, options: yesNo },
    { id: "giftedProperty", label: "Дарили имущество?", type: "yes-no", required: true, options: yesNo },
    { id: "soldVehicle", label: "Отчуждали автомобиль?", type: "yes-no", required: true, options: yesNo },
    { id: "dealDetails", label: "Кратко опишите значимые сделки", type: "textarea", visibleWhen: { fieldId: "hasMajorDeals", equals: true } },
  ]},
  { id: "review", number: 10, title: "Итоговая проверка", description: "Проверьте сведения перед переходом к подготовке документов.", fields: [], review: true },
];

const mariaAnswers: QuestionnaireAnswers = { fullName:"Мария Соколова", birthDate:"1988-04-16", city:"Москва", maritalStatus:"Состою в браке", hasSpouse:true, spouseName:"Алексей Соколов", childrenCount:1, hasDependents:false, incomeSource:"Работа по найму", monthlyIncome:92000, officialIncome:true, additionalIncome:false, creditorCount:4, totalDebt:2850000, hasOverdue:true, hasEnforcement:false, hasRealEstate:true, hasVehicle:false, hasValuables:false, realEstateType:"Квартира", ownershipShare:"1/1", realEstateValue:9200000, onlyHousing:true, hasMortgage:true, mortgageBank:"Демо Банк", mortgageBalance:4100000, mortgagePayment:47000 };
const dmitryAnswers: QuestionnaireAnswers = { fullName:"Дмитрий Волков", birthDate:"1982-09-03", city:"Санкт-Петербург", maritalStatus:"Состою в браке", hasSpouse:true, spouseName:"Елена Волкова", childrenCount:2, hasDependents:true, incomeSource:"Предпринимательство", monthlyIncome:185000, officialIncome:true, additionalIncome:true, creditorCount:6, totalDebt:7800000, hasOverdue:true, hasEnforcement:true, hasRealEstate:true, hasVehicle:true, hasValuables:true, valuablesNote:"Оборудование для работы", realEstateType:"Квартира", ownershipShare:"1/1", realEstateValue:14500000, onlyHousing:true, hasMortgage:true, mortgageBank:"Демо Банк Премиум", mortgageBalance:6300000, mortgagePayment:72000, vehicleModel:"Volvo XC60", vehicleYear:2020, vehicleValue:3200000, hasMajorDeals:true, soldRealEstate:false, giftedProperty:false, soldVehicle:true, dealDetails:"Продажа предыдущего автомобиля в 2024 году" };

export const CLIENT_QUESTIONNAIRE_SEEDS = [
  { identityId:"alexander-lite", started:false, initialCompletedSectionIds:[], initialAnswers:{ fullName:"Александр Лебедев" } },
  { identityId:"maria-pro", started:true, initialCompletedSectionIds:["basics","family","income","debts","property","transport"], initialAnswers:mariaAnswers },
  { identityId:"dmitry-individual", started:true, initialCompletedSectionIds:QUESTIONNAIRE_SECTIONS.map((section)=>section.id), initialAnswers:dmitryAnswers },
] as const satisfies readonly ClientQuestionnaireSeed[];

export function getQuestionnaireSeed(identityId:string) { return CLIENT_QUESTIONNAIRE_SEEDS.find((item)=>item.identityId===identityId); }
export function getQuestionnaireSummary(answers:QuestionnaireAnswers) { return { ...answers }; }
export function isQuestionnaireFieldVisible(field:QuestionnaireSection["fields"][number], answers:QuestionnaireAnswers) { return !field.visibleWhen || answers[field.visibleWhen.fieldId] === field.visibleWhen.equals; }
