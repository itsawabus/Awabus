// Generates human-friendly, auto-incrementing display IDs (RT-001, ST-2026-001, TRP-0001, ...)
// by inspecting the highest existing code for a given model/prefix.

const pad = (num, size) => String(num).padStart(size, '0');

export const nextSequentialCode = async (Model, field, prefix, size = 3) => {
  const regex = new RegExp(`^${prefix}(\\d{${size}})$`);
  const docs = await Model.find({ [field]: regex }).select(field).lean();
  let max = 0;
  docs.forEach((doc) => {
    const match = doc[field].match(regex);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `${prefix}${pad(max + 1, size)}`;
};

export const nextYearCode = async (Model, field, prefix, year = new Date().getFullYear(), size = 3) => {
  const regex = new RegExp(`^${prefix}-${year}-(\\d{${size}})$`);
  const docs = await Model.find({ [field]: regex }).select(field).lean();
  let max = 0;
  docs.forEach((doc) => {
    const match = doc[field].match(regex);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `${prefix}-${year}-${pad(max + 1, size)}`;
};
