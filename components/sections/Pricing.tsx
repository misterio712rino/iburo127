"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  Crown,
  Sparkles,
} from "lucide-react";

const plans = [
  {
    name: "Лайт",
    badge: "",
    oldPrice: "34 990 ₽",
    price: "7 990 ₽",

    description:
      "Для тех, кто хочет пройти процедуру самостоятельно и значительно сократить расходы.",

    features: [
      "Подробные видеоуроки",
      "Готовые документы",
      "Пошаговый алгоритм действий",
      "Домашние задания",
      "Экономия более 150 000 ₽",
    ],

    button: "Получить LIGHT",

    href:
      "https://samospisanie-dolgov.getcourse.ru/showcase?trainingId=935471478",

    type: "light",
  },

  {
    name: "PRO",
    badge: "Рекомендуем",

    oldPrice: "129 990 ₽",
    price: "29 990 ₽",

    description:
      "Оптимальный вариант для тех, кто хочет пройти процедуру правильно с поддержкой и проверкой документов.",

    features: [
      "Все возможности LIGHT",
      "Разбор документов",
      "Проверка перед подачей",
      "Поддержка куратора",
      "Защита ипотечного жилья",
    ],

    button: "Получить PRO",

    href:
      "https://samospisanie-dolgov.getcourse.ru/showcase?trainingId=935515580",

    type: "pro",
  },

  {
    name: "Эксклюзив",
    badge: "VIP",

    oldPrice: null,
    price: "Индивидуально",

    description:
      "Персональное сопровождение, сложные случаи и возможность построить собственную практику.",

    features: [
      "Все возможности PRO",
      "Персональный эксперт",
      "Стратегии защиты имущества",
      "Закрытое сообщество",
      "Бизнес-модуль",
      "Правовые технологии",
      "Поддержка без ограничений",
    ],

    button: "Записаться",

    href:
      "#popup:myform",

    type: "vip",
  },
];


export default function Pricing() {

  const [activeCard, setActiveCard] =
    useState<number | null>(null);


  return (

    <section
      id="pricing"
      className="
        relative
        overflow-hidden
        bg-[#F7F5F2]
        py-32
      "
    >

      {/* ===============================
          BACKGROUND
      =============================== */}

      <div className="absolute inset-0">

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-b
            from-white
            via-[#F7F5F2]
            to-[#F2EEE8]
          "
        />


        <div
          className="
            absolute
            left-1/2
            top-0
            h-[800px]
            w-[800px]
            -translate-x-1/2
            rounded-full
            bg-white/70
            blur-[220px]
          "
        />

      </div>


      <div
        className="
          relative
          mx-auto
          max-w-7xl
          px-6
        "
      >


        {/* ===============================
            HEADER
        =============================== */}


        <div
          className="
            mx-auto
            mb-20
            max-w-4xl
            text-center
          "
        >

          <div
            className="
              inline-flex
              items-center
              gap-3
              rounded-full
              border
              border-[#E8DED5]
              bg-white
              px-5
              py-2
              text-sm
              font-semibold
              uppercase
              tracking-[0.3em]
              text-[#7B2330]
            "
          >

            <Sparkles
              className="
                h-4
                w-4
                text-[#C89A4A]
              "
            />

            Тарифы

          </div>


          <h2
            className="
              mt-8
              text-5xl
              font-bold
              leading-tight
              tracking-[-0.05em]
              text-[#1D1D1F]
              lg:text-6xl
            "
          >

            Выберите уровень
            <br />
            поддержки

          </h2>


          <p
            className="
              mx-auto
              mt-8
              max-w-3xl
              text-xl
              leading-9
              text-[#666]
            "
          >

            От самостоятельного прохождения
            до персонального сопровождения
            сложных случаев.

          </p>

        </div>


        {/* ===============================
            CARDS START
        =============================== */}

        <div
          className="
            grid
            gap-8
            lg:grid-cols-3
          "
        >

          {plans.map((plan, index) => {

            const inactive =
              activeCard !== null &&
              activeCard !== index;


            return (


              <article
                key={plan.name}

                onMouseEnter={() =>
                  setActiveCard(index)
                }

                onMouseLeave={() =>
                  setActiveCard(null)
                }

                className={`
                  relative
                  flex
                  flex-col
                  overflow-hidden
                  rounded-[42px]
                  border
                  transition-all
                  duration-500
                  ease-out

                  ${
                    plan.type === "pro"
                      ? `
                        -translate-y-5
                        border-[#C89A4A]
                        bg-white
                        shadow-[0_40px_100px_rgba(123,35,48,.18)]
                      `
                      : plan.type === "vip"
                      ? `
                        border-[#2B2B2B]
                        bg-[#111111]
                        shadow-[0_35px_90px_rgba(0,0,0,.25)]
                      `
                      : `
                        border-[#E8DED5]
                        bg-white
                        shadow-[0_20px_60px_rgba(0,0,0,.06)]
                      `
                  }

                  ${
                    activeCard === index
                      ? `
                        z-20
                        scale-[1.04]
                        -translate-y-4
                        shadow-[0_50px_130px_rgba(0,0,0,.20)]
                      `
                      : ""
                  }

                  ${
                    inactive
                      ? `
                        scale-[0.96]
                        opacity-50
                        blur-[1px]
                      `
                      : ""
                  }
                `}
              >

                {/* BADGE */}

                {plan.badge && (

                  <div
                    className={`
                      absolute
                      right-6
                      top-6
                      rounded-full
                      px-5
                      py-2
                      text-xs
                      font-semibold
                      uppercase
                      tracking-[0.2em]

                      ${
                        plan.type === "vip"
                          ? `
                            bg-[#C89A4A]
                            text-[#111]
                          `
                          : `
                            bg-[#7B2330]
                            text-white
                          `
                      }
                    `}
                  >

                    {plan.badge}

                  </div>

                )}



                {/* HEADER CARD */}

                <div
                  className={`
                    p-10

                    ${
                      plan.type === "vip"
                        ? "text-white"
                        : ""
                    }
                  `}
                >


                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >

                    {plan.type === "vip" && (

                      <Crown
                        className="
                          h-5
                          w-5
                          text-[#C89A4A]
                        "
                      />

                    )}


                    <span
                      className={`
                        text-sm
                        uppercase
                        tracking-[0.35em]

                        ${
                          plan.type === "vip"
                            ? "text-[#C89A4A]"
                            : "text-[#A67C39]"
                        }
                      `}
                    >

                      Тариф

                    </span>

                  </div>



                  <h3
                    className={`
                      mt-5
                      text-4xl
                      font-bold
                      tracking-[-0.05em]

                      ${
                        plan.type === "vip"
                          ? "text-white"
                          : "text-[#1D1D1F]"
                      }
                    `}
                  >

                    {plan.name}

                  </h3>



                  <p
                    className={`
                      mt-6
                      text-[17px]
                      leading-8

                      ${
                        plan.type === "vip"
                          ? "text-white/70"
                          : "text-[#666]"
                      }
                    `}
                  >

                    {plan.description}

                  </p>




                  {/* PRICE */}


                  <div className="mt-10">

                    <span
                      className={`
                        text-sm
                        uppercase
                        tracking-[0.3em]

                        ${
                          plan.type === "vip"
                            ? "text-white/50"
                            : "text-[#999]"
                        }
                      `}
                    >

                      Стоимость

                    </span>



                    {plan.oldPrice && (

                      <div
                        className="
                          mt-4
                          text-xl
                          text-[#999]
                          line-through
                        "
                      >

                        {plan.oldPrice}

                      </div>

                    )}



                    <div
                      className={`
                        mt-2
                        font-bold
                        tracking-[-0.05em]

                        ${
                          plan.type === "vip"
                            ? `
                              text-4xl
                              text-[#C89A4A]
                            `
                            : `
                              text-6xl
                              text-[#7B2330]
                            `
                        }
                      `}
                    >

                      {plan.price}

                    </div>


                    <div
                      className={`
                        mt-3
                        text-sm

                        ${
                          plan.type === "vip"
                            ? "text-white/50"
                            : "text-[#999]"
                        }
                      `}
                    >

                      Единовременный платеж

                    </div>


                  </div>


                </div>



                {/* DIVIDER */}

                <div
                  className={`
                    border-t

                    ${
                      plan.type === "vip"
                        ? "border-white/10"
                        : "border-[#EFE7DE]"
                    }
                  `}
                />
                                {/* FEATURES */}

                <div
                  className="
                    flex-1
                    px-10
                    py-8
                  "
                >

                  <ul
                    className="
                      space-y-5
                    "
                  >

                    {plan.features.map((feature) => (

                      <li
                        key={feature}
                        className="
                          flex
                          items-start
                          gap-4
                        "
                      >

                        <div
                          className={`
                            mt-1
                            flex
                            h-6
                            w-6
                            shrink-0
                            items-center
                            justify-center
                            rounded-full

                            ${
                              plan.type === "vip"
                                ? "bg-[#C89A4A]/20"
                                : "bg-[#7B2330]/10"
                            }
                          `}
                        >

                          <Check
                            className={`
                              h-4
                              w-4

                              ${
                                plan.type === "vip"
                                  ? "text-[#C89A4A]"
                                  : "text-[#7B2330]"
                              }
                            `}
                          />

                        </div>


                        <span
                          className={`
                            leading-8

                            ${
                              plan.type === "vip"
                                ? "text-white/80"
                                : "text-[#555]"
                            }
                          `}
                        >

                          {feature}

                        </span>


                      </li>

                    ))}

                  </ul>


                </div>



                {/* BUTTON */}

                <div
                  className="
                    px-10
                    pb-10
                  "
                >

                  <a
                    href={plan.href}

                    className={`
                      group
                      flex
                      h-16
                      w-full
                      items-center
                      justify-center
                      rounded-full
                      text-lg
                      font-semibold
                      transition-all
                      duration-500

                      ${
                        plan.type === "pro"
                          ? `
                            bg-[#7B2330]
                            text-white
                            hover:bg-[#651B25]
                          `
                          : plan.type === "vip"
                          ? `
                            bg-[#C89A4A]
                            text-[#111]
                            hover:bg-[#B17F2F]
                          `
                          : `
                            bg-[#C89A4A]
                            text-white
                            hover:bg-[#B17F2F]
                          `
                      }

                      hover:-translate-y-1
                      hover:shadow-2xl
                    `}
                  >

                    {plan.button}


                    <ArrowRight
                      className="
                        ml-3
                        h-5
                        w-5
                        transition-transform
                        duration-300
                        group-hover:translate-x-1
                      "
                    />


                  </a>



                  {/* FOOTER */}

                  <div
                    className={`
                      mt-8
                      space-y-3
                      border-t
                      pt-8

                      ${
                        plan.type === "vip"
                          ? "border-white/10"
                          : "border-[#EFE7DE]"
                      }
                    `}
                  >

                    {[
                      "Моментальный доступ",
                      "Онлайн 24/7",
                      "Доступ на 90 дней",
                    ].map((item) => (

                      <div
                        key={item}
                        className="
                          flex
                          items-center
                          gap-3
                          text-sm
                        "
                      >

                        <div
                          className={`
                            h-2
                            w-2
                            rounded-full

                            ${
                              plan.type === "vip"
                                ? "bg-[#C89A4A]"
                                : "bg-[#7B2330]"
                            }
                          `}
                        />


                        <span
                          className={`
                            ${
                              plan.type === "vip"
                                ? "text-white/60"
                                : "text-[#666]"
                            }
                          `}
                        >

                          {item}

                        </span>


                      </div>

                    ))}


                  </div>


                </div>


              </article>

            );

          })}


        </div>


      </div>


    </section>

  );

}