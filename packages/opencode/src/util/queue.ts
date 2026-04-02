type Stat = {
  id: number
  name: string
  size: number
  max: number
  push: number
  pull: number
  wait: number
}

const all = new Map<number, Stat>()
let next = 0

export function stats() {
  return [...all.values()].map((item) => ({ ...item }))
}

export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []
  private id: number | undefined

  constructor(input?: { name?: string }) {
    if (!input?.name) return
    this.id = ++next
    all.set(this.id, {
      id: this.id,
      name: input.name,
      size: 0,
      max: 0,
      push: 0,
      pull: 0,
      wait: 0,
    })
  }

  push(item: T) {
    const itemStat = this.item()
    if (itemStat) itemStat.push++
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
    this.sync()
  }

  async next(): Promise<T> {
    if (this.queue.length > 0) {
      const value = this.queue.shift()!
      const itemStat = this.item()
      if (itemStat) itemStat.pull++
      this.sync()
      return value
    }

    return new Promise((resolve) => {
      this.resolvers.push((value) => {
        const itemStat = this.item()
        if (itemStat) itemStat.pull++
        this.sync()
        resolve(value)
      })
      this.sync()
    })
  }

  done() {
    if (this.id === undefined) return
    all.delete(this.id)
  }

  async *[Symbol.asyncIterator]() {
    while (true) yield await this.next()
  }

  private item() {
    if (this.id === undefined) return
    return all.get(this.id)
  }

  private sync() {
    const itemStat = this.item()
    if (!itemStat) return
    itemStat.size = this.queue.length
    itemStat.max = Math.max(itemStat.max, itemStat.size)
    itemStat.wait = this.resolvers.length
  }
}

export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}
