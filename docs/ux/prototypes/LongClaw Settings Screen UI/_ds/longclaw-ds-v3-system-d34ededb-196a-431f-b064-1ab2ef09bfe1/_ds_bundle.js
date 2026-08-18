/* @ds-bundle: {"format":4,"namespace":"LongClawDesignSystem_d34ede","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"Avatar","sourcePath":"components/avatars/Avatar.jsx"},{"name":"BoardCard","sourcePath":"components/cards/BoardCard.jsx"},{"name":"Chip","sourcePath":"components/chips/Chip.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"PriorityIcon","sourcePath":"components/indicators/PriorityIcon.jsx"},{"name":"StatusIcon","sourcePath":"components/indicators/StatusIcon.jsx"},{"name":"Checklist","sourcePath":"components/timeline/Checklist.jsx"},{"name":"TimelineEntry","sourcePath":"components/timeline/TimelineEntry.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"c0465b370759","components/avatars/Avatar.jsx":"355bf510b325","components/cards/BoardCard.jsx":"f0eecbc55a62","components/chips/Chip.jsx":"03e9388262ac","components/feedback/Banner.jsx":"c3c1399bd0e1","components/feedback/Toast.jsx":"1613bf635e9b","components/forms/Input.jsx":"73f0144935ba","components/indicators/PriorityIcon.jsx":"ead160be7127","components/indicators/StatusIcon.jsx":"25cd19f60141","components/timeline/Checklist.jsx":"0a418232377a","components/timeline/TimelineEntry.jsx":"8742de0380b9"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LongClawDesignSystem_d34ede = window.LongClawDesignSystem_d34ede || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = 'primary',
  size = 'default',
  hint,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const small = size === 'small';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: small ? 24 : 30,
    padding: small ? '0 9px' : '0 12px',
    border: 'none',
    borderRadius: 'var(--radius-control)',
    fontFamily: 'var(--font-ui)',
    fontSize: small ? 11.5 : 13,
    fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? .5 : 1,
    transition: 'filter var(--t-hover) var(--ease)'
  };
  const variants = {
    primary: {
      background: 'var(--human)',
      color: 'var(--on-human)'
    },
    secondary: {
      background: 'var(--surface)',
      border: '1px solid var(--ctrl-border)',
      color: 'var(--ink)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)'
    },
    danger: {
      background: 'var(--surface)',
      border: '1px solid var(--danger-border)',
      color: 'var(--danger)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    },
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.filter = 'brightness(0.96)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.filter = '';
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.filter = 'brightness(0.92)';
    },
    onMouseUp: e => {
      e.currentTarget.style.filter = 'brightness(0.96)';
    }
  }, rest), children, hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      background: 'color-mix(in srgb, currentColor 18%, transparent)',
      borderRadius: 'var(--radius-kbd)',
      padding: '1px 5px'
    }
  }, hint));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/avatars/Avatar.jsx
try { (() => {
function Avatar({
  initials = '',
  hue = 1,
  agent = false,
  size = 26
}) {
  if (agent) return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      boxSizing: 'border-box',
      borderRadius: 4,
      background: 'var(--avatar-agent-bg)',
      border: '1.5px solid color-mix(in oklab, var(--agent) 65%, transparent)',
      color: 'var(--agent)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: Math.round(size * 0.42),
      fontWeight: 600,
      flexShrink: 0
    }
  }, "\u276F");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: `var(--avatar-${hue}-bg)`,
      color: `var(--avatar-${hue}-fg)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-ui)',
      fontSize: Math.round(size * 0.41),
      fontWeight: 600,
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/avatars/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/chips/Chip.jsx
try { (() => {
function Chip({
  variant = 'label',
  dot,
  children,
  style
}) {
  if (variant === 'label') return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 22,
      padding: '0 9px',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-chip)',
      background: 'var(--surface)',
      fontFamily: 'var(--font-ui)',
      fontSize: 11.5,
      fontWeight: 500,
      color: 'var(--ink-2)',
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: dot,
      flexShrink: 0
    }
  }), children);
  const agent = variant === 'agent';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 22,
      padding: '0 9px',
      borderRadius: 'var(--radius-control)',
      background: agent ? 'var(--agent-tint)' : 'var(--human-tint)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 500,
      color: agent ? 'var(--agent)' : 'var(--human)',
      ...style
    }
  }, agent && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "\u276F"), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chips/Chip.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
const warnIcon = /*#__PURE__*/React.createElement("svg", {
  width: "15",
  height: "15",
  viewBox: "0 0 14 14",
  style: {
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M7 1.5 L13 12 L1 12 Z",
  fill: "none",
  stroke: "var(--warn)",
  strokeWidth: "1.4",
  strokeLinejoin: "round"
}), /*#__PURE__*/React.createElement("rect", {
  x: "6.35",
  y: "5.2",
  width: "1.3",
  height: "3.4",
  rx: "0.65",
  fill: "var(--warn)"
}), /*#__PURE__*/React.createElement("rect", {
  x: "6.35",
  y: "9.6",
  width: "1.3",
  height: "1.3",
  rx: "0.65",
  fill: "var(--warn)"
}));
function Banner({
  children,
  actions,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--warn-bg)',
      border: '1px solid var(--warn-border)',
      borderRadius: 'var(--radius-card)',
      padding: '10px 12px',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, warnIcon, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--ink)',
      flex: 1
    }
  }, children), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, actions));
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  children,
  kbd,
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--toast-bg)',
      color: 'var(--toast-fg)',
      borderRadius: 'var(--radius-card)',
      padding: '9px 12px',
      fontFamily: 'var(--font-ui)',
      fontSize: 12.5,
      boxShadow: 'var(--shadow-toast)',
      ...style
    }
  }, children, kbd && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      background: 'var(--toast-kbd)',
      borderRadius: 'var(--radius-kbd)',
      padding: '1px 5px'
    }
  }, kbd), action && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--toast-muted)'
    }
  }, action));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const folderIcon = /*#__PURE__*/React.createElement("svg", {
  width: "13",
  height: "13",
  viewBox: "0 0 14 14",
  style: {
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M1.5 3.5 Q1.5 2.5 2.5 2.5 L5 2.5 L6.2 4 L11.5 4 Q12.5 4 12.5 5 L12.5 10.5 Q12.5 11.5 11.5 11.5 L2.5 11.5 Q1.5 11.5 1.5 10.5 Z",
  fill: "none",
  stroke: "var(--ink-3)",
  strokeWidth: "1.3"
}));
function Input({
  variant = 'default',
  placeholder,
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const path = variant === 'path';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'var(--row-control)',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 10px',
      border: `1px solid ${focus ? 'var(--human)' : 'var(--ctrl-border)'}`,
      borderRadius: 'var(--radius-control)',
      background: 'var(--surface)',
      boxShadow: focus ? '0 0 0 3px var(--focus-ring)' : 'none',
      transition: 'box-shadow var(--t-hover) var(--ease), border-color var(--t-hover) var(--ease)',
      ...style
    }
  }, path && folderIcon, /*#__PURE__*/React.createElement("input", _extends({
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: path ? 'var(--font-mono)' : 'var(--font-ui)',
      fontSize: path ? 12 : 13,
      color: path ? 'var(--ink-2)' : 'var(--ink)',
      padding: 0,
      ...inputStyle
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/indicators/PriorityIcon.jsx
try { (() => {
const BARS = [{
  x: 1.5,
  y: 7,
  h: 5.5
}, {
  x: 5.5,
  y: 4,
  h: 8.5
}, {
  x: 9.5,
  y: 1,
  h: 11.5
}];
function PriorityIcon({
  priority = 'medium',
  size = 14
}) {
  if (priority === 'urgent') return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 14 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "1",
    y: "1",
    width: "12",
    height: "12",
    rx: "3",
    fill: "var(--priority-urgent)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6.25",
    y: "3.4",
    width: "1.5",
    height: "4.6",
    rx: "0.75",
    fill: "var(--priority-urgent-fg)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "6.25",
    y: "9.2",
    width: "1.5",
    height: "1.5",
    rx: "0.75",
    fill: "var(--priority-urgent-fg)"
  }));
  if (priority === 'none') return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 14 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2.5",
    y: "6.2",
    width: "9",
    height: "1.6",
    rx: "0.8",
    fill: "var(--priority-none)"
  }));
  const n = {
    high: 3,
    medium: 2,
    low: 1
  }[priority] ?? 2;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 14 14",
    style: {
      flexShrink: 0
    }
  }, BARS.map((b, i) => /*#__PURE__*/React.createElement("rect", {
    key: i,
    x: b.x,
    y: b.y,
    width: "3",
    height: b.h,
    rx: "1",
    fill: i < n ? 'var(--priority)' : 'var(--priority-off)'
  })));
}
Object.assign(__ds_scope, { PriorityIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/indicators/PriorityIcon.jsx", error: String((e && e.message) || e) }); }

// components/indicators/StatusIcon.jsx
try { (() => {
const COLORS = {
  backlog: 'var(--status-backlog)',
  todo: 'var(--status-todo)',
  'in-progress': 'var(--status-progress)',
  'in-review': 'var(--status-review)',
  done: 'var(--status-done)',
  canceled: 'var(--status-canceled)'
};
function StatusIcon({
  status = 'todo',
  size = 14
}) {
  const c = COLORS[status] || COLORS.todo;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 14 14",
    style: {
      flexShrink: 0
    }
  }, status === 'backlog' && /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.6",
    strokeDasharray: "2.1 2.5"
  }), status === 'todo' && /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.6"
  }), status === 'in-progress' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 7 L7 3.4 A3.6 3.6 0 0 1 7 10.6 Z",
    fill: c
  })), status === 'in-review' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5",
    fill: "none",
    stroke: c,
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 7 L7 3.4 A3.6 3.6 0 1 1 3.4 7 Z",
    fill: c
  })), status === 'done' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "4.3,7.3 6.3,9.3 9.8,5.4",
    fill: "none",
    stroke: "var(--on-human)",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), status === 'canceled' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.8 4.8 L9.2 9.2 M9.2 4.8 L4.8 9.2",
    stroke: "var(--status-canceled-x)",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  })));
}
Object.assign(__ds_scope, { StatusIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/indicators/StatusIcon.jsx", error: String((e && e.message) || e) }); }

// components/cards/BoardCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BoardCard({
  id,
  title,
  status = 'todo',
  priority = 'medium',
  label,
  assignee,
  progress,
  agentFresh = false,
  agentNote,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: 246,
      boxSizing: 'border-box',
      background: 'var(--surface)',
      border: `1px solid ${agentFresh ? 'var(--agent-border)' : 'var(--line)'}`,
      borderRadius: 'var(--radius-card)',
      padding: '10px 12px',
      boxShadow: agentFresh ? '0 0 0 3px var(--agent-ring)' : 'var(--shadow-card)',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--ink-3)'
    }
  }, id), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), agentFresh && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--agent)',
      animation: 'lcPulse 1.8s ease-out infinite'
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.PriorityIcon, {
    priority: priority,
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--ink)',
      lineHeight: 1.35,
      marginBottom: 8
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusIcon, {
    status: status,
    size: 13
  }), progress && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--agent)',
      fontWeight: 500
    }
  }, progress.done, "/", progress.total), /*#__PURE__*/React.createElement("span", {
    style: {
      height: 3,
      width: 44,
      borderRadius: 2,
      background: 'var(--line-soft)',
      overflow: 'hidden',
      display: 'inline-block'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: '100%',
      width: `${Math.round(progress.done / progress.total * 100)}%`,
      background: 'var(--agent)',
      borderRadius: 2
    }
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: 19,
      padding: '0 7px',
      border: '1px solid var(--line)',
      borderRadius: 10,
      fontSize: 10.5,
      fontWeight: 500,
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: label.color
    }
  }), label.name), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), assignee && /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    initials: assignee.initials,
    hue: assignee.hue,
    size: 20
  })), agentNote && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      paddingTop: 7,
      borderTop: '1px solid var(--line-soft)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--agent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "\u276F"), agentNote));
}
Object.assign(__ds_scope, { BoardCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/BoardCard.jsx", error: String((e && e.message) || e) }); }

// components/timeline/Checklist.jsx
try { (() => {
function Checklist({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, items.map((it, i) => {
    const s = it.state || 'open';
    const fresh = s === 'agent-fresh';
    const done = s === 'done' || fresh;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        ...(fresh ? {
          background: 'var(--agent-tint)',
          borderRadius: 6,
          padding: '3px 6px',
          margin: '0 -6px'
        } : {})
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 14 14",
      style: {
        flexShrink: 0
      }
    }, done ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      x: "1",
      y: "1",
      width: "12",
      height: "12",
      rx: "3.5",
      fill: fresh ? 'var(--agent)' : 'var(--ink-3)'
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "4,7.2 6.2,9.2 10,4.9",
      fill: "none",
      stroke: fresh ? 'var(--on-agent)' : 'var(--status-canceled-x)',
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })) : /*#__PURE__*/React.createElement("rect", {
      x: "1.5",
      y: "1.5",
      width: "11",
      height: "11",
      rx: "3",
      fill: "none",
      stroke: "var(--check-border)",
      strokeWidth: "1.5"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: s === 'done' ? 'var(--ink-3)' : 'var(--ink)',
        textDecoration: s === 'done' ? 'line-through' : 'none'
      }
    }, it.text), it.meta && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--agent)'
      }
    }, it.meta));
  }));
}
Object.assign(__ds_scope, { Checklist });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/timeline/Checklist.jsx", error: String((e && e.message) || e) }); }

// components/timeline/TimelineEntry.jsx
try { (() => {
function TimelineEntry({
  variant = 'human',
  author,
  time,
  via,
  children,
  style
}) {
  if (variant === 'event') return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 36,
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 14 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "6",
    fill: "var(--agent)"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "4.3,7.3 6.3,9.3 9.8,5.4",
    fill: "none",
    stroke: "var(--on-agent)",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, children, time && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--ink-3)'
    }
  }, " \xB7 ", time)));
  const agent = variant === 'agent';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    agent: agent,
    initials: author && author.initials,
    hue: author && author.hue || 1,
    size: 26
  }), /*#__PURE__*/React.createElement("div", {
    style: agent ? {
      flex: 1,
      borderLeft: '2px solid color-mix(in oklab, var(--agent) 35%, transparent)',
      paddingLeft: 12
    } : {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 3,
      flexWrap: 'wrap'
    }
  }, agent ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--agent)'
    }
  }, author && author.name) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, author && author.name), agent && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--agent)',
      background: 'var(--agent-tint)',
      borderRadius: 3,
      padding: '1px 5px'
    }
  }, "agent"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      color: 'var(--ink-3)'
    }
  }, time, via ? ` · ${via}` : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.5,
      color: 'var(--ink)'
    }
  }, children)));
}
Object.assign(__ds_scope, { TimelineEntry });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/timeline/TimelineEntry.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.BoardCard = __ds_scope.BoardCard;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.PriorityIcon = __ds_scope.PriorityIcon;

__ds_ns.StatusIcon = __ds_scope.StatusIcon;

__ds_ns.Checklist = __ds_scope.Checklist;

__ds_ns.TimelineEntry = __ds_scope.TimelineEntry;

})();
