const runtimeConfig = {
  enforceBusinessHours: process.env.ENFORCE_BUSINESS_HOURS === "true",
  simularFalhaSatGlobal: false
};

function getConfig() {
  return { ...runtimeConfig };
}

function updateConfig(patch) {
  if (typeof patch.enforceBusinessHours === "boolean") {
    runtimeConfig.enforceBusinessHours = patch.enforceBusinessHours;
  }
  if (typeof patch.simularFalhaSatGlobal === "boolean") {
    runtimeConfig.simularFalhaSatGlobal = patch.simularFalhaSatGlobal;
  }
  return getConfig();
}

function isBusinessHoursNow() {
  // Horário comercial: Segunda a Sexta, das 10h00 às 18h00 no fuso de São Paulo
  const now = new Date();
  const options = { timeZone: "America/Sao_Paulo", hour12: false };
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...options,
    weekday: "short",
    hour: "numeric",
    minute: "numeric"
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const businessDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (!businessDays.includes(weekday)) {
    return false;
  }

  const timeInMinutes = hour * 60 + minute;
  const startMinutes = 10 * 60; // 10:00
  const endMinutes = 18 * 60; // 18:00

  return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
}

module.exports = {
  getConfig,
  updateConfig,
  isBusinessHoursNow
};
