import { describe, expect, it } from 'vitest'
import { callEngine } from './pyodideHarness'

interface SolveCase {
  expr: string
  var?: string
}

const LINEAR: SolveCase[] = [
  { expr: '2*x + 4 = 0' },
  { expr: 'x - 7 = 0' },
  { expr: '3*x = 9' },
  { expr: '-5*x + 10 = 0' },
  { expr: 'x/2 + 3 = 0' },
  { expr: '7*x - 14 = 0' },
  { expr: '2*y + 6 = 0', var: 'y' },
  { expr: '4*x + 1 = 9' },
  { expr: '10 - 2*x = 0' },
  { expr: 'x + x + 2 = 0' },
]

const QUADRATIC: SolveCase[] = [
  { expr: 'x**2 - 4 = 0' },
  { expr: 'x**2 - 5*x + 6 = 0' },
  { expr: 'x**2 + 2*x + 1 = 0' },
  { expr: 'x**2 - 9 = 0' },
  { expr: '2*x**2 - 8 = 0' },
  { expr: 'x**2 + x - 6 = 0' },
  { expr: 'x**2 - 2*x - 3 = 0' },
  { expr: 'x**2 + 4*x + 4 = 0' },
  { expr: '3*x**2 - 12 = 0' },
  { expr: 'x**2 - 6*x + 9 = 0' },
]

describe('solve_steps: linear equations', () => {
  for (const c of LINEAR) {
    it(c.expr, async () => {
      const r = await callEngine('solve_steps', c.expr, c.var ?? 'x')
      expect(r.ok).toBe(true)
      expect(r.solutions.length).toBeGreaterThan(0)
      for (const sol of r.solutions) expect(sol.verified).toBe(true)
    })
  }
})

describe('solve_steps: quadratic equations', () => {
  for (const c of QUADRATIC) {
    it(c.expr, async () => {
      const r = await callEngine('solve_steps', c.expr, c.var ?? 'x')
      expect(r.ok).toBe(true)
      expect(r.solutions.length).toBeGreaterThan(0)
      for (const sol of r.solutions) expect(sol.verified).toBe(true)
    })
  }
})

interface DiffCase {
  expr: string
  expected?: string
}

const DERIVATIVES: DiffCase[] = [
  { expr: 'x**3' },
  { expr: 'x**2 + 3*x + 1' },
  { expr: 'sin(x)' },
  { expr: 'cos(x)' },
  { expr: 'exp(x)' },
  { expr: 'log(x)' },
  { expr: 'sqrt(x)' },
  { expr: 'x*sin(x)' },
  { expr: 'sin(x**2)' },
  { expr: 'exp(2*x)' },
  { expr: '(x + 1)**3' },
  { expr: '3*x**4 - 2*x**2 + 7' },
  { expr: 'x**2 * cos(x)' },
  { expr: 'sin(x) * cos(x)' },
  { expr: '2**x' },
  { expr: 'log(x**2 + 1)' },
  { expr: 'tan(x)' },
  { expr: 'x**5 + x**3 + x' },
  { expr: 'sqrt(x**2 + 1)' },
  { expr: 'exp(x) * sin(x)' },
]

describe('diff_steps: derivatives (verified against sympy.diff)', () => {
  for (const c of DERIVATIVES) {
    it(c.expr, async () => {
      const r = await callEngine('diff_steps', c.expr)
      expect(r.ok).toBe(true)
      expect(r.verified).toBe(true)
      expect(r.steps.length).toBeGreaterThan(0)
    })
  }
})

const INTEGRALS: string[] = [
  'x**2',
  'x**3',
  'x',
  '1',
  'sin(x)',
  'cos(x)',
  'exp(x)',
  '1/x',
  '3*x**2',
  'x**2 + x + 1',
  '2*sin(x)',
  '4*x**3 - 6*x',
  '5',
  'x**4',
  '-cos(x)',
]

describe('integrate_steps: antiderivatives (verified by differentiating the result)', () => {
  for (const expr of INTEGRALS) {
    it(expr, async () => {
      const r = await callEngine('integrate_steps', expr)
      expect(r.ok).toBe(true)
      expect(r.verified).toBe(true)
    })
  }
})

const SIMPLIFICATIONS: string[] = [
  '(x**2 - 1)/(x - 1)',
  'sin(x)**2 + cos(x)**2',
  '(x + 1)**2 - (x**2 + 2*x + 1)',
  '2*x + 3*x',
  'x/x',
]

describe('simplify_expr', () => {
  for (const expr of SIMPLIFICATIONS) {
    it(expr, async () => {
      const r = await callEngine('simplify_expr', expr)
      expect(r.ok).toBe(true)
      expect(r.result).toBeDefined()
    })
  }
})
