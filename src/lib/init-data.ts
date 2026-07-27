import { z } from "zod"

const jsonString = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" })
        return z.NEVER
      }
    })
    .pipe(schema)

const safeInteger = z.number().int()
const integerString = z
  .string()
  .regex(/^-?\d+$/u)
  .transform(Number)
  .pipe(safeInteger)
const nonNegativeIntegerString = integerString.pipe(z.number().nonnegative())
const authDateSchema = nonNegativeIntegerString
  .transform((value) => new Date(value * 1000))
  .refine((value) => !Number.isNaN(value.getTime()), { message: "Invalid auth_date" })

const initDataUserSchema = z.looseObject({
  id: safeInteger,
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_bot: z.boolean().optional(),
  is_premium: z.boolean().optional(),
  added_to_attachment_menu: z.boolean().optional(),
  allows_write_to_pm: z.boolean().optional(),
  photo_url: z.string().optional(),
})

const initDataChatSchema = z.looseObject({
  id: safeInteger,
  type: z.string(),
  title: z.string(),
  photo_url: z.string().optional(),
  username: z.string().optional(),
})

const initDataSchema = z.looseObject({
  auth_date: authDateSchema,
  can_send_after: nonNegativeIntegerString.optional(),
  chat: jsonString(initDataChatSchema).optional(),
  chat_type: z.string().optional(),
  chat_instance: z.string().optional(),
  hash: z.string().regex(/^[\da-f]{64}$/u),
  query_id: z.string().optional(),
  receiver: jsonString(initDataUserSchema).optional(),
  signature: z.string().optional(),
  start_param: z.string().optional(),
  user: jsonString(initDataUserSchema).optional(),
})

type InitData = z.infer<typeof initDataSchema>
type InitDataUser = z.infer<typeof initDataUserSchema>

/**
 * Parses raw init data (a query string) into a typed structure.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
const parseInitData = (value: string | URLSearchParams): InitData => {
  const params = typeof value === "string" ? new URLSearchParams(value) : value
  return initDataSchema.parse(Object.fromEntries(params.entries()))
}

export { initDataSchema, parseInitData, type InitData, type InitDataUser }
