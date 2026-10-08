/** Error con código HTTP; `errorResponse` lo convierte en la respuesta JSON. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
