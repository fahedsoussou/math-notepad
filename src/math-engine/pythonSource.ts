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
import pint

# Electrical mode (Phase 5). Pint isn't a Pyodide built-in package, so it's
# installed via micropip before this source runs (see worker.ts/
# pyodideHarness.ts) — importing it here just uses what's already there.
_UREG = pint.UnitRegistry()

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

# ---- Phase 5: Electrical mode --------------------------------------------

def convert_units(value, from_unit, to_unit):
    def run():
        q = _UREG.Quantity(float(value), from_unit)
        converted = q.to(to_unit)
        return {'ok': True, 'value': converted.magnitude, 'unit': str(converted.units)}
    return _safe(run)

def impedance_rlc(resistance, inductance, capacitance, frequency_hz):
    """Series RLC impedance at a given frequency, with the step-by-step
    reactance breakdown an EE student would actually write out. Returns
    magnitude/angle (polar) since that's how impedance is normally read
    off, plus the rectangular a+bj form for anyone who wants to add it to
    another impedance by hand."""
    def run():
        omega = 2 * sympy.pi * sympy.Float(frequency_hz)
        R = sympy.Float(resistance)
        steps = [{'text': f'R = {R} ohm (resistance contributes no reactance)'}]

        XL = sympy.Float(0)
        if inductance:
            L = sympy.Float(inductance)
            XL = omega * L
            steps.append({'text': f'X_L = 2*pi*f*L = {sympy.N(XL, 6)} ohm (inductive reactance, +j)'})

        XC = sympy.Float(0)
        if capacitance:
            C = sympy.Float(capacitance)
            XC = 1 / (omega * C)
            steps.append({'text': f'X_C = 1/(2*pi*f*C) = {sympy.N(XC, 6)} ohm (capacitive reactance, -j)'})

        Z = R + sympy.I * (XL - XC)
        # Full precision for the arithmetic/verification; only the
        # *displayed* values below are rounded to 6 significant figures.
        # Verifying against the rounded display value instead of this would
        # fail for any impedance where 6-sig-fig rounding error exceeds the
        # 1e-6 check tolerance (easily true once |Z| is in the tens+) — a
        # false "not verified" on a correct answer, not a real problem.
        magnitude_full = sympy.Abs(Z)
        angle_rad = sympy.atan2(sympy.im(Z), sympy.re(Z))
        magnitude = sympy.N(magnitude_full, 6)
        angle_deg = sympy.N(angle_rad * 180 / sympy.pi, 6)
        steps.append({'text': f'Z = R + j(X_L - X_C) = {sympy.N(sympy.re(Z), 6)} + {sympy.N(sympy.im(Z), 6)}j ohm'})
        steps.append({'text': f'|Z| = {magnitude} ohm, angle = {angle_deg} degrees'})

        # Numeric sanity check: rebuild the rectangular form from the
        # full-precision polar result and compare — same spirit as the
        # other _steps functions, verifying the answer rather than just
        # trusting it.
        rebuilt_real = magnitude_full * sympy.cos(angle_rad)
        rebuilt_imag = magnitude_full * sympy.sin(angle_rad)
        verified = abs(float(rebuilt_real) - float(sympy.re(Z))) < 1e-6 and abs(float(rebuilt_imag) - float(sympy.im(Z))) < 1e-6

        return {
            'ok': True,
            'steps': [{'text': s['text']} for s in steps],
            'rectangular': {'real': float(sympy.re(Z)), 'imag': float(sympy.im(Z))},
            'polar': {'magnitude': float(magnitude), 'angle_deg': float(angle_deg)},
            'verified': verified,
        }
    return _safe(run)

# ---- Phase 6: advanced math -----------------------------------------------

def series_steps(expr_str, var_name='x', about=0, order=5, notation=None):
    """Taylor series of expr about x=about, up to the given order, built
    term by term (f(a), f'(a), f''(a)/2!, ...) rather than one opaque
    sympy.series() call, so each coefficient is its own visible step.
    Convergence: a ratio test on the *computed* coefficients — this is
    based on the first order terms actually produced, not a proof for
    every term of the true infinite series, and is marked as such."""
    def run():
        var = symbols(var_name, real=True)
        expr = _parse(expr_str, notation, var_name)
        a = sympy.Rational(about).limit_denominator(10**6) if not isinstance(about, int) else sympy.Integer(about)
        steps = []
        terms = []
        coeffs = []
        current = expr
        for n in range(order + 1):
            value_at_a = current.subs(var, a)
            coeff = sympy.simplify(value_at_a / sympy.factorial(n))
            coeffs.append(coeff)
            term = coeff * (var - a) ** n
            terms.append(term)
            steps.append({'text': f'Term {n}: f^({n})(a)/{n}! * (x-a)^{n} = {sympy.N(coeff, 6)} * (x - {a})^{n}'})
            current = diff(current, var)
        polynomial = sympy.expand(sum(terms))

        # Ratio test on the computed coefficients (last two non-zero ones).
        nonzero = [c for c in coeffs if c != 0]
        convergence = None
        if len(nonzero) >= 2:
            ratio = sympy.Abs(sympy.N(nonzero[-1] / nonzero[-2]))
            convergence = {
                'ratio_last_two_terms': float(ratio),
                'note': 'Based only on the terms actually computed above, not a general proof for every term of the infinite series.',
            }

        # Numeric check: the polynomial should approximate f near x=a (a
        # Taylor series is only ever a local approximation, so this checks
        # "close", not "equal", and only a small displacement from a).
        test_point = a + sympy.Rational(1, 20)
        try:
            exact = complex(expr.subs(var, test_point).evalf())
            approx = complex(polynomial.subs(var, test_point).evalf())
            verified = abs(exact - approx) < 0.05
        except Exception:
            verified = None

        return {
            'ok': True,
            'steps': steps,
            'polynomial': _fmt(polynomial),
            'convergence': convergence,
            'verified': verified,
        }
    return _safe(run)

def stats_summary(data):
    """Descriptive statistics for a list of numbers, with the textbook
    step sequence (sum -> mean -> deviations -> variance -> std), and the
    variance cross-checked against the "computational formula"
    (E[x^2] - E[x]^2) as an independent recomputation rather than trusting
    one formula."""
    def run():
        values = [sympy.Rational(v).limit_denominator(10**9) for v in data]
        n = len(values)
        if n == 0:
            return {'ok': False, 'error': 'No data given.'}
        total = sum(values)
        mean = sympy.simplify(total / n)
        sorted_values = sorted(values)
        mid = n // 2
        median = sorted_values[mid] if n % 2 == 1 else (sorted_values[mid - 1] + sorted_values[mid]) / 2

        deviations = [v - mean for v in values]
        sq_dev_sum = sum(d * d for d in deviations)
        sample_variance = sympy.simplify(sq_dev_sum / (n - 1)) if n > 1 else sympy.Integer(0)
        std_dev = sympy.sqrt(sample_variance)

        # Independent cross-check: E[x^2] - E[x]^2 (population formula,
        # scaled to the sample version) should match sq_dev_sum/(n-1).
        mean_of_squares = sympy.simplify(sum(v * v for v in values) / n)
        population_variance_check = sympy.simplify(mean_of_squares - mean * mean)
        # Bessel's correction: population var * n / (n-1) = sample var.
        rescaled = sympy.simplify(population_variance_check * n / (n - 1)) if n > 1 else sympy.Integer(0)
        verified = n <= 1 or abs(float(rescaled) - float(sample_variance)) < 1e-9

        return {
            'ok': True,
            'steps': [
                {'text': f'Sum = {sympy.N(total, 6)}, n = {n}'},
                {'text': f'Mean = sum/n = {sympy.N(mean, 6)}'},
                {'text': f'Median = {sympy.N(median, 6)}'},
                {'text': f'Sum of squared deviations from the mean = {sympy.N(sq_dev_sum, 6)}'},
                {'text': f'Sample variance = sum_sq_dev / (n-1) = {sympy.N(sample_variance, 6)}'},
                {'text': f'Standard deviation = sqrt(variance) = {sympy.N(std_dev, 6)}'},
            ],
            'mean': float(mean),
            'median': float(median),
            'variance': float(sample_variance),
            'std_dev': float(std_dev),
            'verified': verified,
        }
    return _safe(run)

def matrix_steps(matrix, operation):
    """operation: 'determinant' | 'inverse' | 'eigenvalues'. matrix is a
    list of equal-length rows of numbers."""
    def run():
        M = sympy.Matrix([[sympy.nsimplify(x) for x in row] for row in matrix])
        if M.rows != M.cols:
            return {'ok': False, 'error': f'Need a square matrix for {operation}; got {M.rows}x{M.cols}.'}

        if operation == 'determinant':
            det = M.det()
            steps = [{'text': f'det(M) = {sympy.N(det, 6)}'}]
            # Cross-check with cofactor expansion along the first row for
            # anything small enough that it's cheap to redo independently.
            verified = True
            if M.rows <= 4:
                cofactor_det = sum(
                    (-1) ** j * M[0, j] * M.minor_submatrix(0, j).det() for j in range(M.cols)
                )
                verified = sympy.simplify(det - cofactor_det) == 0
            return {'ok': True, 'steps': steps, 'result': _fmt(det), 'verified': verified}

        if operation == 'inverse':
            det = M.det()
            if det == 0:
                return {'ok': False, 'error': 'This matrix is singular (determinant 0) — it has no inverse.'}
            inv = M.inv()
            steps = [
                {'text': f'det(M) = {sympy.N(det, 6)} (nonzero, so an inverse exists)'},
                {'text': 'M_inv computed via adjugate / det(M)'},
            ]
            identity_check = sympy.simplify(M * inv - sympy.eye(M.rows))
            verified = identity_check == sympy.zeros(M.rows, M.rows)
            return {
                'ok': True,
                'steps': steps,
                'result': {'text': str(inv.tolist())},
                'verified': verified,
            }

        if operation == 'eigenvalues':
            eigenvals = M.eigenvals()
            steps = [{'text': f'Characteristic polynomial: det(M - lambda*I) = {sympy.N(M.charpoly().as_expr(), 6)}'}]
            results = []
            all_verified = True
            for val, multiplicity in eigenvals.items():
                check = sympy.simplify((M - val * sympy.eye(M.rows)).det())
                ok_val = check == 0
                all_verified = all_verified and ok_val
                results.append({'value': _fmt(val), 'multiplicity': multiplicity, 'verified': ok_val})
            return {'ok': True, 'steps': steps, 'eigenvalues': results, 'verified': all_verified}

        return {'ok': False, 'error': f'Unknown operation: {operation}'}
    return _safe(run)

import re as _re
_ODE_PRIME_RE = _re.compile(r"([a-zA-Z_]\\w*)('+)")

def _ode_preprocess(text, func_name, var_name):
    """Lets the user write y'' + y = 0 instead of the formal
    Eq(Derivative(y(x), x, x) + y(x), 0) sympy needs. Converts func' /
    func_prime_prime into Derivative(func(var), var[, var]), and bare func (not
    already followed by '(') into func(var)."""
    def replace_prime(m):
        name, primes = m.group(1), m.group(2)
        if name != func_name:
            return m.group(0)
        order = len(primes)
        var_args = ', '.join([var_name] * order)
        return f'Derivative({func_name}({var_name}), {var_args})'

    text = _ODE_PRIME_RE.sub(replace_prime, text)
    # Bare function name not already applied (func( ) or func(x)).
    text = _re.sub(rf'\\b{func_name}\\b(?!\\s*\\()', f'{func_name}({var_name})', text)
    return text

def ode_solve(equation_str, func_name='y', var_name='x', notation=None):
    def run():
        var = symbols(var_name, real=True)
        func = sympy.Function(func_name)
        text = _ode_preprocess(equation_str, func_name, var_name)
        local_dict = {var_name: var, func_name: func}
        if '=' in text:
            lhs_s, rhs_s = text.split('=', 1)
            lhs = sympy.parsing.sympy_parser.parse_expr(lhs_s, local_dict=local_dict, transformations=TRANSFORMATIONS_IMPLICIT)
            rhs = sympy.parsing.sympy_parser.parse_expr(rhs_s, local_dict=local_dict, transformations=TRANSFORMATIONS_IMPLICIT)
        else:
            lhs = sympy.parsing.sympy_parser.parse_expr(text, local_dict=local_dict, transformations=TRANSFORMATIONS_IMPLICIT)
            rhs = sympy.Integer(0)
        eq = Eq(lhs, rhs)
        solution = sympy.dsolve(eq, func(var))

        # Verify by substituting the solution back into the original ODE.
        check_expr = (lhs - rhs).subs(func(var), solution.rhs)
        check_expr = sympy.simplify(check_expr.doit())
        verified = check_expr == 0

        return {
            'ok': True,
            'steps': [{'text': f'Equation: {eq}'}, {'text': f'Solution: {solution}'}],
            'result': _fmt(solution),
            'verified': verified,
        }
    return _safe(run)

def laplace_transform_steps(expr_str, var_name='t', s_name='s', notation=None):
    def run():
        t = symbols(var_name, positive=True)
        s = symbols(s_name)
        expr = _parse(expr_str, notation, var_name)
        F = sympy.laplace_transform(expr, t, s, noconds=True)
        steps = [{'text': f'L{{{expr}}}(s) = {F}'}]

        # Verify by taking the inverse transform and comparing to the
        # original — the one direction that's mechanical here, same
        # spirit as verifying integration by differentiating the result.
        try:
            back = sympy.inverse_laplace_transform(F, s, t)
            verified = sympy.simplify(back - expr) == 0
        except Exception:
            verified = None

        return {'ok': True, 'steps': steps, 'result': _fmt(F), 'verified': verified}
    return _safe(run)

# ---- Check my work --------------------------------------------------------

def check_work(lines, var_name='x', notation=None):
    """Checks each line against the previous one, flagging the FIRST line
    that doesn't follow, so the student can see exactly where it went
    wrong rather than only "the final answer is wrong". Two consecutive
    EQUATIONS are consistent if they have the same solution set (compared
    numerically, since exact symbolic equality of solution sets isn't
    reliable beyond simple polynomials); two consecutive EXPRESSIONS are
    consistent if they're numerically equal. This does not try to guess
    *which* algebra rule the student intended to apply on that line, only
    whether the line is mathematically consistent with the one before it
    - a real but deliberately narrower version of "check my work" than a
    full tutoring system would do."""
    def run():
        var = symbols(var_name, real=True)
        parsed = []
        for line in lines:
            text = line.strip()
            if not text:
                continue
            try:
                if '=' in text:
                    lhs_s, rhs_s = text.split('=', 1)
                    lhs = _parse(lhs_s, notation, var_name)
                    rhs = _parse(rhs_s, notation, var_name)
                    parsed.append({'text': text, 'kind': 'equation', 'value': lhs - rhs})
                else:
                    parsed.append({'text': text, 'kind': 'expression', 'value': _parse(text, notation, var_name)})
            except Exception as exc:
                return {'ok': False, 'error': f'Could not read this line: "{text}" ({exc})'}

        if len(parsed) == 0:
            return {'ok': False, 'error': 'No lines to check.'}

        results = [{'line': parsed[0]['text'], 'status': 'start'}]
        first_wrong_line = None
        for i in range(1, len(parsed)):
            prev, curr = parsed[i - 1], parsed[i]
            status = 'unverifiable'
            if prev['kind'] == 'expression' and curr['kind'] == 'expression':
                eq = verify_equal_numeric(prev['value'], curr['value'], var_name)
                status = 'ok' if eq else ('wrong' if eq is False else 'unverifiable')
            elif prev['kind'] == 'equation' and curr['kind'] == 'equation':
                try:
                    sol_prev = sorted((complex(sympy.N(s)) for s in solve(Eq(prev['value'], 0), var)), key=lambda c: (c.real, c.imag))
                    sol_curr = sorted((complex(sympy.N(s)) for s in solve(Eq(curr['value'], 0), var)), key=lambda c: (c.real, c.imag))
                    if len(sol_prev) == len(sol_curr):
                        status = 'ok' if all(abs(a - b) < 1e-6 for a, b in zip(sol_prev, sol_curr)) else 'wrong'
                except Exception:
                    pass
            results.append({'line': curr['text'], 'status': status})
            if status == 'wrong' and first_wrong_line is None:
                first_wrong_line = i

        return {'ok': True, 'lines': results, 'first_wrong_line': first_wrong_line}
    return _safe(run)
`
