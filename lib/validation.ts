import { z } from "zod";

export const purchaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid purchase date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a valid purchase date.")
  .refine((value) => new Date(`${value}T00:00:00.000Z`).getTime() <= Date.now(), {
    message: "Purchase date cannot be in the future."
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
