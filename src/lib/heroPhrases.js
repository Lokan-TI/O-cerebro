// Frases de abertura — tom de direção estratégica. Uma diferente a cada acesso.
export const HERO_PHRASES = [
  { top: "Os dados já sabem.", accent: "A decisão é sua." },
  { top: "Toda frota tem um limite.", accent: "Poucos sabem onde ele está." },
  { top: "Crescer é fácil.", accent: "Crescer com margem, não." },
  { top: "O risco não avisa.", accent: "Os números, sim." },
  { top: "Não é sobre alugar mais.", accent: "É sobre alugar melhor." },
  { top: "Sua base vale mais", accent: "do que o próximo cliente." },
  { top: "Direção não se improvisa.", accent: "Se calcula." },
  { top: "Onde o dinheiro entra", accent: "raramente é onde ele fica." },
  { top: "Cada equipamento parado", accent: "é uma decisão adiada." },
  { top: "Estratégia é escolher", accent: "o que não fazer." },
];

export function pickHeroPhrase() {
  return HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)];
}