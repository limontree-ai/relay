import type { TableMap, Version } from '../types'

export type Store = { [K in keyof TableMap]: TableMap[K][] } & { versions: Version[] }
