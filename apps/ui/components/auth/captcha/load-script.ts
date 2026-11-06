type ScriptOptions<Api> = {
    src: string
    readApi: () => Api | undefined
    failure: () => Error
    // A vendor that only declares its API ready through a global callback named in the script URL.
    readyCallback?: string
}

// One load per page for a captcha vendor's script. A failed load is forgotten, so the next attempt
// fetches it again instead of failing forever.
export function scriptLoader<Api>({ src, readApi, failure, readyCallback }: ScriptOptions<Api>): () => Promise<Api> {
    let loading: Promise<Api> | null = null
    return () => {
        loading ??= new Promise<Api>((resolve, reject) => {
            const script = document.createElement('script')
            const ready = () => {
                const api = readApi()
                if (api) resolve(api)
                else reject(failure())
            }
            script.src = src
            script.async = true
            if (readyCallback) (window as unknown as Record<string, () => void>)[readyCallback] = ready
            else script.onload = ready
            script.onerror = () => {
                loading = null
                script.remove()
                reject(failure())
            }
            document.head.appendChild(script)
        })
        return loading
    }
}
