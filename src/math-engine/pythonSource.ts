// Python source run inside Pyodide (SymPy). Shared verbatim between the
// browser Web Worker (worker.ts, loaded via importScripts from a CDN) and
// the Node-side Vitest test bank (tests/math-engine.test.ts, loaded via the
// `pyodide` npm package) — one engine, two ways of running it, so the test
// bank genuinely exercises the same code the app uses.
//
// Every public function returns a plain dict (JSON-serialisable once
// pyodide's `toJs`/`to_py` round-trips it) with at least `{ ok, error }`,
// so the TS client never has to catch a raw Python exception.
export const PY_SOURCE = `
import sympy
from sympy import symbols, sympify, Eq, solve, diff, integrate, simplify, latex, srepr
from sympy.core.function import AppliedUndef
import random
import traceback

TRANSFORMATIONS_IMPLICIT = sympy.parsing.sympy_parser.standard_transformations + (
    sympy.parsing.sympy_parser.implicit_multiplication_application,
    sympy.parsing.sympy_parser.convert_xor,
)
TRANSFORMATIONS_EXPLICIT = sympy.parsing.sympy_parser.standard_transformations + (
    sympy.parsing.sympy_parser.convert_xor,
)

def _parse(expr_str, notation=None, var_name='x'):
    """Parse user text into a SymPy expression, honouring notation settings.
    notation: optional dict with keys 'imaginary' ('i'|'j'),
    'euler_as_variable' (bool), and 'implicit_multiplication' (bool) — see
    NOTATION settings in Settings screen. Crucially, this must produce the
    *same* Symbol object (same name AND same assumptions) that every other
    function builds via symbols(var_name, real=True) — SymPy treats
    Symbol('x') and Symbol('x', real=True) as different symbols entirely,
    so without this an expression parsed from text would silently never
    match var in expr.has(var)/is_polynomial(var)/etc., making every rule
    think the variable isn't present at all."""
    s = expr_str.strip()
    local_dict = {var_name: symbols(var_name, real=True)}
    if notation and notation.get('imaginary') == 'j':
        s = s.replace('j', 'I')
    if notation and notation.get('euler_as_variable'):
        # 'e' stays a free symbol instead of Euler's number.
        local_dict['e'] = symbols('e', real=True)
    else:
        # sympy's parser does NOT recognise bare 'e' as Euler's number on
        # its own — without this it silently becomes a generic Symbol('e'),
        # which is the whole default-notation setting's point, so it must
        # be explicit here.
        local_dict['e'] = sympy.E
    transformations = TRANSFORMATIONS_EXPLICIT if (notation and notation.get('implicit_multiplication') is False) else TRANSFORMATIONS_IMPLICIT
    return sympy.parsing.sympy_parser.parse_expr(s, local_dict=local_dict, transformations=transformations)

def _safe(fn):
    try:
        return fn()
    except Exception as exc:
        return {'ok': False, 'error': str(exc), 'trace': traceback.format_exc()}

def _fmt(expr):
    return {'latex': latex(expr), 'text': str(expr)}

def verify_numeric(original_expr, var_name, solution_expr, trials=5):
    """Substitutes trials random rational values for every OTHER free
    symbol (if any) and checks original_expr evaluates to ~0 (for an
    equation lhs-rhs=0 form) at the given solution. Returns True/False;
    never raises — an unverifiable step (e.g. symbolic result with a free
    parameter) returns None, and callers must mark it as unverified."""
    try:
        var = symbols(var_name, real=True)
        others = [s for s in original_expr.free_symbols if s != var]
        for _ in range(trials):
            subs = {o: sympy.Rational(random.randint(-9, 9), random.randint(1, 4)) for o in others}
            val = original_expr.subs(var, solution_expr).subs(subs)
            val = complex(val) if val.has(sympy.I) else float(val)
            if abs(val) > 1e-6:
                return False
        return True
    except Exception:
        return None

def verify_equal_numeric(expr_a, expr_b, var_name, trials=6):
    """General numeric equality check: substitutes random rational values
    for the given variable (and any other free symbols) and checks
    expr_a - expr_b is ~0 each time. Tries exact symbolic equality first
    (fast, and exact when it works); falls back to this for cases SymPy's
    simplify can't collapse on its own (e.g. sign(x)/Abs(x) vs 1/x), which
    is common enough with Abs/sign/trig identities that relying on
    symbolic simplify alone would wrongly mark correct answers
    unverified."""
    try:
        if sympy.simplify(expr_a - expr_b) == 0:
            return True
    except Exception:
        pass
    try:
        var = symbols(var_name, real=True)
        free = (expr_a.free_symbols | expr_b.free_symbols)
        others = [s for s in free if s != var]
        checked = 0
        for _ in range(trials * 3):
            if checked >= trials:
                break
            x_val = sympy.Rational(random.randint(-9, 9), random.randint(1, 4))
            if x_val == 0:
                continue
            subs = {var: x_val}
            for o in others:
                subs[o] = sympy.Rational(random.randint(-9, 9), random.randint(1, 4))
            try:
                diff_val = complex((expr_a - expr_b).subs(subs).evalf())
            except Exception:
                continue  # singular point or domain issue for this trial; try another
            if abs(diff_val) > 1e-6:
                return False
            checked += 1
        return True if checked > 0 else None
    except Exception:
        return None

def solve_steps(expr_str, var_name='x', notation=None):
    def run():
        var = symbols(var_name, real=True)
        if '=' in expr_str:
            lhs_s, rhs_s = expr_str.split('=', 1)
            lhs, rhs = _parse(lhs_s, notation, var_name), _parse(rhs_s, notation, var_name)
        else:
            lhs, rhs = _parse(expr_str, notation, var_name), sympy.Integer(0)
        eq = Eq(lhs, rhs)
        moved = sympy.expand(lhs - rhs)
        steps = [{'text': 'Move everything to one side', 'expr': _fmt(Eq(moved, 0))}]

        poly = sympy.Poly(moved, var) if moved.is_polynomial(var) else None
        degree = poly.degree() if poly else None

        if degree == 1:
            a = poly.coeff_monomial(var)
            b = poly.coeff_monomial(1)
            steps.append({'text': f'Linear equation: {a}*{var_name} + ({b}) = 0', 'expr': _fmt(Eq(moved, 0))})
            sol = sympy.simplify(-b / a)
            steps.append({'text': f'{var_name} = -({b}) / ({a})', 'expr': _fmt(Eq(var, sol))})
            solutions = [sol]
        elif degree == 2:
            a = poly.coeff_monomial(var**2)
            b = poly.coeff_monomial(var)
            c = poly.coeff_monomial(1)
            steps.append({'text': f'Quadratic: a={a}, b={b}, c={c}', 'expr': _fmt(Eq(moved, 0))})
            disc = sympy.simplify(b**2 - 4*a*c)
            steps.append({'text': f'Discriminant = b^2 - 4ac = {disc}', 'expr': _fmt(disc)})
            sol1 = sympy.simplify((-b + sympy.sqrt(disc)) / (2*a))
            sol2 = sympy.simplify((-b - sympy.sqrt(disc)) / (2*a))
            steps.append({
                'text': 'Quadratic formula: x = (-b +/- sqrt(disc)) / (2a)',
                'expr': {'latex': latex(Eq(var, sympy.Symbol('x_{1,2}'))), 'text': f'x1 = {sol1}, x2 = {sol2}'},
            })
            solutions = [sol1, sol2]
        else:
            solutions = solve(eq, var)
            steps.append({
                'text': 'Solved symbolically (degree too high, or not polynomial, for a shown breakdown)',
                'expr': _fmt(solutions),
                'unverified_breakdown': True,
            })

        verified = []
        for s in solutions:
            v = verify_numeric(moved, var_name, s)
            verified.append({'solution': _fmt(s), 'verified': v})

        return {'ok': True, 'steps': steps, 'solutions': verified}
    return _safe(run)

def _diff_steps_inner(expr, var):
    """Recursively decomposes a derivative by SymPy's expression tree,
    returning (result_expr, [ {rule, before, after} ]). Covers sum, constant
    multiple, product, quotient, power, chain rule, and the common
    elementary functions — not a universal CAS, but real coverage, not a
    single opaque sympy.diff() call."""
    steps = []
    if not expr.has(var):
        return sympy.Integer(0), [{'rule': 'constant', 'before': str(expr), 'after': '0'}]

    if expr == var:
        return sympy.Integer(1), [{'rule': 'd/dx[x] = 1', 'before': str(expr), 'after': '1'}]

    if isinstance(expr, sympy.Add):
        parts = []
        total = sympy.Integer(0)
        for term in expr.args:
            d, sub_steps = _diff_steps_inner(term, var)
            steps.extend(sub_steps)
            total += d
            parts.append(str(d))
        steps.append({'rule': 'sum rule', 'before': str(expr), 'after': ' + '.join(parts)})
        return sympy.expand(total), steps

    if isinstance(expr, sympy.Mul):
        const_part = sympy.Integer(1)
        var_factors = []
        for f in expr.args:
            if f.has(var):
                var_factors.append(f)
            else:
                const_part = const_part * f
        if not var_factors:
            return sympy.Integer(0), [{'rule': 'constant', 'before': str(expr), 'after': '0'}]
        if len(var_factors) == 1 and const_part != 1:
            d, sub_steps = _diff_steps_inner(var_factors[0], var)
            steps.extend(sub_steps)
            steps.append({'rule': 'constant multiple', 'before': str(expr), 'after': f'{const_part} * ({d})'})
            return sympy.expand(const_part * d), steps
        # Product rule across all var-dependent factors, folded pairwise.
        f, g = var_factors[0], sympy.Mul(*var_factors[1:]) if len(var_factors) > 1 else sympy.Integer(1)
        df, sf = _diff_steps_inner(f, var)
        dg, sg = _diff_steps_inner(g, var) if g != 1 else (sympy.Integer(0), [])
        steps.extend(sf)
        steps.extend(sg)
        result = sympy.expand(const_part * (df * g + f * dg))
        steps.append({'rule': 'product rule: d/dx[f*g] = f_deriv*g + f*g_deriv', 'before': str(expr), 'after': str(result)})
        return result, steps

    if isinstance(expr, sympy.Pow):
        base, exp = expr.args
        if not exp.has(var):
            dbase, sub_steps = _diff_steps_inner(base, var)
            steps.extend(sub_steps)
            result = sympy.expand(exp * base**(exp - 1) * dbase)
            steps.append({'rule': 'power rule + chain rule', 'before': str(expr), 'after': str(result)})
            return result, steps
        # variable exponent: d/dx[b^x] handled via logarithmic differentiation
        dexp, sub_steps = _diff_steps_inner(exp, var)
        steps.extend(sub_steps)
        result = sympy.expand(expr * sympy.log(base) * dexp)
        steps.append({'rule': 'exponential rule: d/dx[b^u] = b^u * ln(b) * u_deriv', 'before': str(expr), 'after': str(result)})
        return result, steps

    elementary = {
        sympy.sin: lambda u: sympy.cos(u),
        sympy.cos: lambda u: -sympy.sin(u),
        sympy.tan: lambda u: 1 / sympy.cos(u)**2,
        sympy.exp: lambda u: sympy.exp(u),
        sympy.log: lambda u: 1 / u,
        sympy.sqrt: lambda u: 1 / (2 * sympy.sqrt(u)),
    }
    for fn, deriv in elementary.items():
        if isinstance(expr, fn):
            (inner,) = expr.args
            dinner, sub_steps = _diff_steps_inner(inner, var)
            steps.extend(sub_steps)
            result = sympy.expand(deriv(inner) * dinner)
            steps.append({'rule': f'd/dx[{fn.__name__}(u)] + chain rule', 'before': str(expr), 'after': str(result)})
            return result, steps

    # Fallback: no decomposition rule matched (e.g. a special function) —
    # use sympy.diff directly for one honest, clearly-marked step.
    result = diff(expr, var)
    steps.append({'rule': 'computed directly (no step breakdown available for this form)', 'before': str(expr), 'after': str(result), 'unverified_breakdown': True})
    return result, steps

def diff_steps(expr_str, var_name='x', notation=None):
    def run():
        var = symbols(var_name, real=True)
        expr = _parse(expr_str, notation, var_name)
        result, steps = _diff_steps_inner(expr, var)
        result = sympy.simplify(result)
        reference = diff(expr, var)
        matches_sympy = verify_equal_numeric(result, reference, var_name)
        return {
            'ok': True,
            'steps': [{'text': s.get('rule', ''), 'expr': {'text': f"{s['before']}  ->  {s['after']}"}, 'unverified_breakdown': s.get('unverified_breakdown', False)} for s in steps],
            'result': _fmt(result),
            'verified': matches_sympy,
        }
    return _safe(run)

BASIC_INTEGRAL_RULES = [
    ('power rule', lambda e, v: e.is_Pow and e.args[0] == v and not e.args[1].has(v)),
]

def _integrate_steps_inner(expr, var):
    steps = []
    if not expr.has(var):
        return expr * var, [{'rule': 'constant rule', 'before': str(expr), 'after': f'{expr}*{var}'}]

    if isinstance(expr, sympy.Add):
        total = sympy.Integer(0)
        parts = []
        for term in expr.args:
            r, sub = _integrate_steps_inner(term, var)
            steps.extend(sub)
            total += r
            parts.append(str(r))
        steps.append({'rule': 'sum rule', 'before': str(expr), 'after': ' + '.join(parts)})
        return sympy.expand(total), steps

    if isinstance(expr, sympy.Mul):
        const_part = sympy.Integer(1)
        var_factors = []
        for f in expr.args:
            if f.has(var):
                var_factors.append(f)
            else:
                const_part = const_part * f
        if len(var_factors) <= 1:
            inner = var_factors[0] if var_factors else sympy.Integer(1)
            r, sub = _integrate_steps_inner(inner, var)
            steps.extend(sub)
            steps.append({'rule': 'constant multiple', 'before': str(expr), 'after': f'{const_part} * ({r})'})
            return sympy.expand(const_part * r), steps
        # Multiple variable factors (e.g. a true product): no general
        # elementary rule — fall through to the sympy fallback below.
        raise _NoRule()

    if expr == var:
        return var**2 / 2, [{'rule': 'power rule: integral of x = x^2/2', 'before': str(expr), 'after': f'{var}^2/2'}]

    if isinstance(expr, sympy.Pow) and expr.args[0] == var and not expr.args[1].has(var):
        n = expr.args[1]
        if n == -1:
            return sympy.log(sympy.Abs(var)), [{'rule': 'integral of x^-1 = ln|x|', 'before': str(expr), 'after': f'ln|{var}|'}]
        result = var**(n + 1) / (n + 1)
        return result, [{'rule': f'power rule: integral of x^{n} = x^{n+1}/{n+1}', 'before': str(expr), 'after': str(result)}]

    elementary = {
        sympy.sin: (lambda: -sympy.cos(var), f'integral of sin(x) = -cos(x)'),
        sympy.cos: (lambda: sympy.sin(var), f'integral of cos(x) = sin(x)'),
        sympy.exp: (lambda: sympy.exp(var), f'integral of e^x = e^x'),
    }
    for fn, (result_fn, label) in elementary.items():
        if isinstance(expr, fn) and expr.args[0] == var:
            return result_fn(), [{'rule': label, 'before': str(expr), 'after': str(result_fn())}]

    raise _NoRule()

class _NoRule(Exception):
    pass

def integrate_steps(expr_str, var_name='x', notation=None):
    def run():
        var = symbols(var_name, real=True)
        expr = _parse(expr_str, notation, var_name)
        try:
            result, steps = _integrate_steps_inner(expr, var)
            unverified = False
        except _NoRule:
            result = integrate(expr, var)
            steps = [{'rule': 'computed directly (no elementary step breakdown available for this form)', 'before': str(expr), 'after': str(result)}]
            unverified = True

        # Verify by differentiating the result and comparing to the
        # original integrand — this is the real check for integration,
        # since differentiation is always mechanical.
        check = verify_equal_numeric(diff(result, var), expr, var_name)

        return {
            'ok': True,
            'steps': [{'text': s['rule'], 'expr': {'text': f"{s['before']}  ->  {s['after']}"}} for s in steps],
            'result': _fmt(result + sympy.Symbol('C')),
            'verified': check,
            'unverified_breakdown': unverified,
        }
    return _safe(run)

def simplify_expr(expr_str, notation=None):
    def run():
        expr = _parse(expr_str, notation)
        result = simplify(expr)
        return {'ok': True, 'steps': [{'text': 'Simplified', 'expr': _fmt(result)}], 'result': _fmt(result)}
    return _safe(run)

def plot_points(expr_str, var_name='x', x_min=-10, x_max=10, samples=200, notation=None):
    def run():
        var = symbols(var_name, real=True)
        expr = _parse(expr_str, notation, var_name)
        f = sympy.lambdify(var, expr, 'math')
        xs, ys = [], []
        step = (x_max - x_min) / (samples - 1)
        for i in range(samples):
            x = x_min + i * step
            try:
                y = f(x)
                if isinstance(y, complex) or y != y:  # NaN check
                    continue
                xs.append(x)
                ys.append(float(y))
            except Exception:
                continue
        return {'ok': True, 'xs': xs, 'ys': ys}
    return _safe(run)
`
