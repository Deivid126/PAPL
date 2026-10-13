export interface MailInput {
  to: string;
  subject: string;
  /** Tipo do e-mail: email-verification | password-reset | generic */
  type: string;
  body: string;
}

export interface MailAdapter {
  send(input: MailInput): Promise<void>;
}