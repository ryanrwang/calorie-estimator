/**
 * Design Token System — calorie-estimator
 *
 * Two-layer architecture:
 *   primitives → named by what they ARE   (color.gray.200, spacing.16)
 *   semantic   → named by what they DO    (color.text.primary, spacing.md)
 *
 * Breakpoints and z-index are intentionally NOT tokenized.
 * They have implicit ordering dependencies that make token indirection
 * more confusing than helpful. Use raw values with comments instead.
 */

(function () {
    'use strict';

    // ──────────────────────────────────────────────
    // PRIMITIVES — raw design values
    // ──────────────────────────────────────────────

    var primitives = {

        color: {
            // Neutral gray scale
            white:    '#FFFFFF',
            gray: {
                50:   '#FAFAF9',
                100:  '#F5F5F4',
                200:  '#E7E5E4',
                300:  '#D6D3D1',
                400:  '#A8A29E',
                500:  '#78716C',
                600:  '#57534E',
                700:  '#44403C',
                800:  '#292524',
                900:  '#1C1917',
                950:  '#0C0A09',
            },
            black:    '#09090B',

            // Primary brand — muted orange
            orange: {
                50:   '#FFF7ED',
                100:  '#FFEDD5',
                200:  '#FED7AA',
                300:  '#FDBA74',
                400:  '#FB923C',
                500:  '#D97706',
                600:  '#C2680A',
                700:  '#A35709',
                800:  '#854D0E',
                900:  '#713F12',
                950:  '#422006',
            },

            // Status colors
            red: {
                50:   '#FEF2F2',
                100:  '#FEE2E2',
                400:  '#F87171',
                500:  '#EF4444',
                600:  '#DC2626',
                700:  '#B91C1C',
                900:  '#7F1D1D',
            },
            green: {
                50:   '#F0FDF4',
                100:  '#DCFCE7',
                400:  '#4ADE80',
                500:  '#22C55E',
                600:  '#16A34A',
                700:  '#15803D',
                900:  '#14532D',
            },
            yellow: {
                50:   '#FEFCE8',
                100:  '#FEF9C3',
                400:  '#FACC15',
                500:  '#EAB308',
                600:  '#CA8A04',
                700:  '#A16207',
                900:  '#713F12',
            },
            blue: {
                50:   '#EFF6FF',
                100:  '#DBEAFE',
                400:  '#60A5FA',
                500:  '#3B82F6',
                600:  '#2563EB',
                700:  '#1D4ED8',
                900:  '#1E3A5F',
            },
        },

        // 4px base spacing grid
        spacing: {
            0:   '0px',
            1:   '1px',
            2:   '2px',
            4:   '4px',
            8:   '8px',
            12:  '12px',
            16:  '16px',
            20:  '20px',
            24:  '24px',
            32:  '32px',
            40:  '40px',
            48:  '48px',
            56:  '56px',
            64:  '64px',
            80:  '80px',
            96:  '96px',
            128: '128px',
        },

        fontSize: {
            xs:   '12px',
            sm:   '14px',
            base: '16px',
            lg:   '18px',
            xl:   '20px',
            '2xl': '24px',
            '3xl': '30px',
            '4xl': '36px',
        },

        fontWeight: {
            normal:   '400',
            medium:   '500',
            semibold: '600',
            bold:     '700',
        },

        lineHeight: {
            tight:  '1.25',
            normal: '1.5',
            relaxed: '1.625',
        },

        radius: {
            none: '0px',
            sm:   '4px',
            md:   '8px',
            lg:   '12px',
            xl:   '16px',
            full: '9999px',
        },

        shadow: {
            none: 'none',
            sm:   '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md:   '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            lg:   '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
            xl:   '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        },

        duration: {
            fast:   '100ms',
            normal: '200ms',
            slow:   '300ms',
            slower: '500ms',
        },

        easing: {
            default:  'cubic-bezier(0.4, 0, 0.2, 1)',
            in:       'cubic-bezier(0.4, 0, 1, 1)',
            out:      'cubic-bezier(0, 0, 0.2, 1)',
            inOut:    'cubic-bezier(0.4, 0, 0.2, 1)',
            bounce:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
        },

        opacity: {
            0:    '0',
            5:    '0.05',
            10:   '0.1',
            25:   '0.25',
            50:   '0.5',
            75:   '0.75',
            90:   '0.9',
            100:  '1',
        },
    };

    // ──────────────────────────────────────────────
    // SEMANTIC — named by purpose, references primitives
    // ──────────────────────────────────────────────

    var semantic = {
        light: {
            color: {
                text: {
                    primary:   primitives.color.gray[900],
                    secondary: primitives.color.gray[600],
                    tertiary:  primitives.color.gray[500],
                    inverse:   primitives.color.white,
                    link:      primitives.color.orange[600],
                    linkHover: primitives.color.orange[700],
                },
                bg: {
                    page:      primitives.color.gray[50],
                    surface:   primitives.color.white,
                    surfaceRaised: primitives.color.white,
                    muted:     primitives.color.gray[100],
                    overlay:   'rgba(0, 0, 0, 0.5)',
                },
                border: {
                    default:   primitives.color.gray[200],
                    strong:    primitives.color.gray[300],
                    focus:     primitives.color.orange[500],
                },
                interactive: {
                    hover:     primitives.color.gray[100],
                    active:    primitives.color.gray[200],
                    selected:  primitives.color.orange[50],
                },
                action: {
                    primary:        primitives.color.orange[500],
                    primaryHover:   primitives.color.orange[600],
                    primaryActive:  primitives.color.orange[700],
                    primaryText:    primitives.color.white,
                    secondary:      primitives.color.gray[200],
                    secondaryHover: primitives.color.gray[300],
                    secondaryActive: primitives.color.gray[400],
                    secondaryText:  primitives.color.gray[800],
                    danger:         primitives.color.red[600],
                    dangerHover:    primitives.color.red[700],
                    dangerText:     primitives.color.white,
                },
                status: {
                    success:     primitives.color.green[600],
                    successBg:   primitives.color.green[50],
                    successText: primitives.color.green[700],
                    warning:     primitives.color.yellow[500],
                    warningBg:   primitives.color.yellow[50],
                    warningText: primitives.color.yellow[700],
                    error:       primitives.color.red[600],
                    errorBg:     primitives.color.red[50],
                    errorText:   primitives.color.red[700],
                    info:        primitives.color.blue[600],
                    infoBg:      primitives.color.blue[50],
                    infoText:    primitives.color.blue[700],
                },
            },
        },

        dark: {
            color: {
                text: {
                    primary:   primitives.color.gray[100],
                    secondary: primitives.color.gray[400],
                    tertiary:  primitives.color.gray[500],
                    inverse:   primitives.color.gray[900],
                    link:      primitives.color.orange[400],
                    linkHover: primitives.color.orange[300],
                },
                bg: {
                    page:      primitives.color.gray[950],
                    surface:   primitives.color.gray[900],
                    surfaceRaised: primitives.color.gray[800],
                    muted:     primitives.color.gray[800],
                    overlay:   'rgba(0, 0, 0, 0.7)',
                },
                border: {
                    default:   primitives.color.gray[700],
                    strong:    primitives.color.gray[600],
                    focus:     primitives.color.orange[400],
                },
                interactive: {
                    hover:     primitives.color.gray[800],
                    active:    primitives.color.gray[700],
                    selected:  primitives.color.orange[950],
                },
                action: {
                    primary:        primitives.color.orange[500],
                    primaryHover:   primitives.color.orange[400],
                    primaryActive:  primitives.color.orange[300],
                    primaryText:    primitives.color.gray[950],
                    secondary:      primitives.color.gray[700],
                    secondaryHover: primitives.color.gray[600],
                    secondaryActive: primitives.color.gray[500],
                    secondaryText:  primitives.color.gray[200],
                    danger:         primitives.color.red[500],
                    dangerHover:    primitives.color.red[400],
                    dangerText:     primitives.color.gray[950],
                },
                status: {
                    success:     primitives.color.green[500],
                    successBg:   primitives.color.green[900],
                    successText: primitives.color.green[400],
                    warning:     primitives.color.yellow[500],
                    warningBg:   primitives.color.yellow[900],
                    warningText: primitives.color.yellow[400],
                    error:       primitives.color.red[500],
                    errorBg:     primitives.color.red[900],
                    errorText:   primitives.color.red[400],
                    info:        primitives.color.blue[500],
                    infoBg:      primitives.color.blue[900],
                    infoText:    primitives.color.blue[400],
                },
            },
        },

        // Theme-independent semantic tokens
        spacing: {
            xs:   primitives.spacing[4],
            sm:   primitives.spacing[8],
            md:   primitives.spacing[16],
            lg:   primitives.spacing[24],
            xl:   primitives.spacing[32],
            '2xl': primitives.spacing[48],
            '3xl': primitives.spacing[64],
        },

        typography: {
            xs:   { fontSize: primitives.fontSize.xs,   lineHeight: primitives.lineHeight.normal, fontWeight: primitives.fontWeight.normal },
            sm:   { fontSize: primitives.fontSize.sm,   lineHeight: primitives.lineHeight.normal, fontWeight: primitives.fontWeight.normal },
            base: { fontSize: primitives.fontSize.base, lineHeight: primitives.lineHeight.normal, fontWeight: primitives.fontWeight.normal },
            lg:   { fontSize: primitives.fontSize.lg,   lineHeight: primitives.lineHeight.normal, fontWeight: primitives.fontWeight.normal },
            xl:   { fontSize: primitives.fontSize.xl,   lineHeight: primitives.lineHeight.tight,  fontWeight: primitives.fontWeight.semibold },
            '2xl': { fontSize: primitives.fontSize['2xl'], lineHeight: primitives.lineHeight.tight, fontWeight: primitives.fontWeight.bold },
            '3xl': { fontSize: primitives.fontSize['3xl'], lineHeight: primitives.lineHeight.tight, fontWeight: primitives.fontWeight.bold },
            '4xl': { fontSize: primitives.fontSize['4xl'], lineHeight: primitives.lineHeight.tight, fontWeight: primitives.fontWeight.bold },
        },

        radius: {
            none: primitives.radius.none,
            sm:   primitives.radius.sm,
            md:   primitives.radius.md,
            lg:   primitives.radius.lg,
            xl:   primitives.radius.xl,
            full: primitives.radius.full,
        },

        shadow: {
            none: primitives.shadow.none,
            sm:   primitives.shadow.sm,
            md:   primitives.shadow.md,
            lg:   primitives.shadow.lg,
            xl:   primitives.shadow.xl,
        },

        transition: {
            fast:   primitives.duration.fast   + ' ' + primitives.easing.default,
            normal: primitives.duration.normal + ' ' + primitives.easing.default,
            slow:   primitives.duration.slow   + ' ' + primitives.easing.default,
            slower: primitives.duration.slower + ' ' + primitives.easing.default,
        },

        opacity: {
            disabled: primitives.opacity[50],
            muted:    primitives.opacity[75],
            overlay:  primitives.opacity[50],
        },
    };

    // ──────────────────────────────────────────────
    // CSS CUSTOM PROPERTY INJECTION
    // ──────────────────────────────────────────────

    function flattenTokens(obj, prefix) {
        var vars = {};
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            var prop = prefix ? prefix + '-' + key : key;
            var val = obj[key];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                var nested = flattenTokens(val, prop);
                for (var k in nested) {
                    if (nested.hasOwnProperty(k)) vars[k] = nested[k];
                }
            } else {
                vars[prop] = val;
            }
        }
        return vars;
    }

    function buildCSSBlock(selector, tokens) {
        var flat = flattenTokens(tokens, '');
        var rules = [];
        for (var key in flat) {
            if (flat.hasOwnProperty(key)) {
                rules.push('  --' + key + ': ' + flat[key] + ';');
            }
        }
        return selector + ' {\n' + rules.join('\n') + '\n}';
    }

    // Build theme-independent semantic tokens (spacing, radius, etc.)
    var themeIndependent = {
        spacing: semantic.spacing,
        radius: semantic.radius,
        shadow: semantic.shadow,
        transition: semantic.transition,
        opacity: semantic.opacity,
    };

    // Build typography as flat properties
    var typographyVars = {};
    for (var scale in semantic.typography) {
        if (semantic.typography.hasOwnProperty(scale)) {
            var t = semantic.typography[scale];
            typographyVars['typography-' + scale + '-fontSize'] = t.fontSize;
            typographyVars['typography-' + scale + '-lineHeight'] = t.lineHeight;
            typographyVars['typography-' + scale + '-fontWeight'] = t.fontWeight;
        }
    }

    var rootCSS = buildCSSBlock(':root', Object.assign({}, semantic.light, themeIndependent));

    // Inject typography vars into :root block (before closing brace)
    var typRules = [];
    for (var tk in typographyVars) {
        if (typographyVars.hasOwnProperty(tk)) {
            typRules.push('  --' + tk + ': ' + typographyVars[tk] + ';');
        }
    }
    rootCSS = rootCSS.replace(/\n\}$/, '\n' + typRules.join('\n') + '\n}');

    var darkCSS = buildCSSBlock('[data-theme="dark"]', semantic.dark);

    var style = document.createElement('style');
    style.id = 'design-tokens';
    style.textContent = rootCSS + '\n\n' + darkCSS;
    document.head.appendChild(style);

    // ──────────────────────────────────────────────
    // EXPOSE GLOBAL
    // ──────────────────────────────────────────────

    window.TOKENS = {
        primitives: primitives,
        semantic: semantic,
    };

})();
