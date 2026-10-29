const SEED_TIME = "2020-01-01T00:00:00.000Z";

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanInt(value) {
  if (typeof value === "number" && Number.isFinite(value) && Math.trunc(value) === value) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizePlace(input) {
  if (!input || typeof input !== "object") return { error: "Invalid company." };

  const companyNumber = cleanInt(input.companyNumber);
  if (companyNumber === null || companyNumber < 1 || companyNumber > 999999999) {
    return { error: "Enter a company number." };
  }

  const category = cleanText(input.category);
  if (!category) return { error: "Enter a category." };
  if (category.length > 80) return { error: "Category must be 80 characters or less." };

  const companyName = cleanText(input.companyName);
  if (!companyName) return { error: "Enter a company name." };
  if (companyName.length > 160) return { error: "Company name must be 160 characters or less." };

  const employeeCount = cleanInt(input.employeeCount);
  if (employeeCount === null || employeeCount < 0 || employeeCount > 10000000) {
    return { error: "Enter the number of employees." };
  }

  const address = cleanText(input.address);
  if (!address) return { error: "Enter an address." };
  if (address.length > 200) return { error: "Address must be 200 characters or less." };

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: "Enter a latitude between -90 and 90." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: "Enter a longitude between -180 and 180." };
  }

  const id = cleanText(input.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Missing company id." };

  const createdAt = input.createdAt || SEED_TIME;
  const updatedAt = input.updatedAt || createdAt;
  if (!validDate(createdAt) || !validDate(updatedAt)) return { error: "Invalid date." };

  let deletedAt = input.deletedAt ?? null;
  if (deletedAt === "") deletedAt = null;
  if (deletedAt !== null && !validDate(deletedAt)) return { error: "Invalid date." };

  return {
    value: {
      id,
      companyNumber,
      category,
      companyName,
      employeeCount,
      address,
      latitude,
      longitude,
      createdAt,
      updatedAt,
      deletedAt,
    },
  };
}

module.exports = { SEED_TIME, normalizePlace };
