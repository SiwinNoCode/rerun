// A captcha drawn into a container. `getToken` asks for a fresh token each time: a token is spent
// by the request that carries it. A second call while one waits rejects the first as superseded.
export type CaptchaWidget = {
    getToken: () => Promise<string>
    remove: () => void
}

export type Waiter = { resolve: (token: string) => void; reject: (error: Error) => void }
