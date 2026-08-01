// ===== 12a-parameters-ui.js =====
// ============================================================================
// PARAMETERS SUB-TAB (Test Configuration › Parameters)
// A Parameter is the lightweight analytical-parameter master record (Ammonia,
// pH, Arsenic...) — code, name, unit, method ref, category, decimal places,
// and an optional Limits block (LOD/LOQ/TAT/fee/detection range/reference
// limits). It intentionally does NOT carry Test Group, Instrument linking,
// Calculation/Formula, or Chemical/Reagent usage — those remain Test Type
// concerns (see 12-testtypes-ui.js), and a Test Type links to one or more
// Parameters via `linkedParameterIds` (many-to-many).
//
// UX: the sub-tab opens straight on the Flat View table with a "+ Add
// Parameter" button top-right. Clicking it toggles to a dedicated form view
// with a "Back to List" button (no modal) — the list is unmounted, not
// hidden, so re-opening always starts clean.
// ============================================================================

function ParameterForm({
  initial,
  onSave,
  onCancel
}) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [shortName, setShortName] = useState(initial?.shortName || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [methodRef, setMethodRef] = useState(initial?.methodRef || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [decimalPlaces, setDecimalPlaces] = useState(initial ? String(initial.decimalPlaces ?? 2) : "2");
  const [lod, setLod] = useState(initial?.lod ?? "");
  const [loq, setLoq] = useState(initial?.loq ?? "");
  const [tatHours, setTatHours] = useState(initial?.tatHours ?? "");
  const [standardFee, setStandardFee] = useState(initial?.standardFee ?? "");
  const [minDetection, setMinDetection] = useState(initial?.minDetection ?? "");
  const [maxDetection, setMaxDetection] = useState(initial?.maxDetection ?? "");
  const [refLimitMin, setRefLimitMin] = useState(initial?.refLimitMin ?? "");
  const [refLimitMax, setRefLimitMax] = useState(initial?.refLimitMax ?? "");
  const [refStandard, setRefStandard] = useState(initial?.refStandard || "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const savingRef = React.useRef(false);

  const errors = {};
  if (submitAttempted) {
    if (!code.trim()) errors.code = "Parameter Code is required.";
    if (!name.trim()) errors.name = "Name is required.";
  }
  const hasErrors = Object.keys(errors).length > 0;

  function handleSubmit() {
    if (savingRef.current) return;
    setSubmitAttempted(true);
    if (!code.trim() || !name.trim()) return;
    savingRef.current = true;
    onSave({
      id: initial?.id || uid("param"),
      code: code.trim(),
      name: name.trim(),
      shortName: shortName.trim(),
      unit: unit.trim(),
      methodRef: methodRef.trim(),
      category: category || "Others",
      decimalPlaces: decimalPlaces === "" ? 2 : Number(decimalPlaces),
      lod: lod === "" ? "" : Number(lod),
      loq: loq === "" ? "" : Number(loq),
      tatHours: tatHours === "" ? "" : Number(tatHours),
      standardFee: standardFee === "" ? "" : Number(standardFee),
      minDetection: minDetection === "" ? "" : Number(minDetection),
      maxDetection: maxDetection === "" ? "" : Number(maxDetection),
      refLimitMin: refLimitMin === "" ? "" : Number(refLimitMin),
      refLimitMax: refLimitMax === "" ? "" : Number(refLimitMax),
      refStandard: refStandard.trim()
    });
    savingRef.current = false;
  }

  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, submitAttempted && hasErrors && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: { background: C.warnBg, color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), "Please fix the highlighted field(s) below before saving."),

  /*#__PURE__*/React.createElement(SectionCard, {
    title: "Parameter Setup",
    icon: /*#__PURE__*/React.createElement(Icon, { name: "beaker", size: 15, color: C.teal })
  },
  /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
    /*#__PURE__*/React.createElement(TextField, {
      label: "Parameter Code *",
      value: code,
      onChange: e => setCode(e.target.value),
      placeholder: "e.g. NH3",
      error: errors.code
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Name *",
      value: name,
      onChange: e => setName(e.target.value),
      placeholder: "e.g. Ammonia",
      error: errors.name
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Short Name",
      value: shortName,
      onChange: e => setShortName(e.target.value),
      placeholder: "e.g. Ammonia"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Unit",
      value: unit,
      onChange: e => setUnit(e.target.value),
      placeholder: "e.g. mg/L"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Method Ref",
      value: methodRef,
      onChange: e => setMethodRef(e.target.value),
      placeholder: "e.g. APHA 4500-NH3 B"
    }),
    /*#__PURE__*/React.createElement(SelectField, {
      label: "Category",
      value: category,
      onChange: e => setCategory(e.target.value),
      options: PARAMETER_CATEGORIES,
      placeholder: "Select category..."
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Decimal Places",
      type: "number",
      min: "0",
      step: "1",
      value: decimalPlaces,
      onChange: e => setDecimalPlaces(e.target.value),
      placeholder: "e.g. 2"
    })
  )),

  /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: "⚑",
    title: "Limits (Optional)",
    subtitle: "LOD/LOQ, turnaround time, fee, detection range, and reference limits",
    defaultOpen: !!(initial && (initial.lod !== "" || initial.loq !== "" || initial.tatHours !== "" || initial.standardFee !== "" || initial.refLimitMax !== "" || initial.refLimitMin !== "" || initial.refStandard))
  },
  /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
    /*#__PURE__*/React.createElement(TextField, {
      label: "LOD (Limit of Detection)",
      type: "number",
      value: lod,
      onChange: e => setLod(e.target.value),
      placeholder: "e.g. 0.01"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "LOQ (Limit of Quantitation)",
      type: "number",
      value: loq,
      onChange: e => setLoq(e.target.value),
      placeholder: "e.g. 0.03"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "TAT (hours)",
      type: "number",
      min: "0",
      value: tatHours,
      onChange: e => setTatHours(e.target.value),
      placeholder: "e.g. 24"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Standard Fee (per test)",
      type: "number",
      min: "0",
      value: standardFee,
      onChange: e => setStandardFee(e.target.value),
      placeholder: "e.g. 100"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Min Detection",
      type: "number",
      value: minDetection,
      onChange: e => setMinDetection(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Max Detection",
      type: "number",
      value: maxDetection,
      onChange: e => setMaxDetection(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Reference Limit Min",
      type: "number",
      value: refLimitMin,
      onChange: e => setRefLimitMin(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Reference Limit Max",
      type: "number",
      value: refLimitMax,
      onChange: e => setRefLimitMax(e.target.value)
    }),
    /*#__PURE__*/React.createElement("div", { className: "md:col-span-2" },
      /*#__PURE__*/React.createElement(TextField, {
        label: "Reference Standard",
        value: refStandard,
        onChange: e => setRefStandard(e.target.value),
        placeholder: "e.g. Bangladesh Drinking Water Standard"
      })
    )
  )),

  /*#__PURE__*/React.createElement("div", { className: "flex justify-end gap-2 mt-1" },
    /*#__PURE__*/React.createElement(Button, { variant: "outline", onClick: onCancel }, "Cancel"),
    /*#__PURE__*/React.createElement(Button, { onClick: handleSubmit }, initial ? "Update Parameter" : "Save Parameter")
  ));
}

function ParametersTab({
  parameters,
  setParameters,
  testTypes,
  notify
}) {
  const [view, setView] = useState("list"); // "list" | "form"
  const [editingParam, setEditingParam] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  function isParameterUsed(id) {
    return (testTypes || []).some(t => (t.linkedParameterIds || []).includes(id));
  }
  function openAdd() {
    setEditingParam(null);
    setView("form");
  }
  function openEdit(p) {
    setEditingParam(p);
    setView("form");
  }
  function backToList() {
    setEditingParam(null);
    setView("list");
  }
  function handleSave(param) {
    if (editingParam) {
      setParameters(prev => prev.map(p => p.id === param.id ? param : p));
      notify(`Parameter "${param.name}" updated`);
    } else {
      setParameters(prev => [...prev, param]);
      notify(`Parameter "${param.name}" created`);
    }
    setView("list");
    setEditingParam(null);
  }
  function handleDelete(p) {
    if (isParameterUsed(p.id)) {
      notify("This parameter is linked to one or more Test Types — unlink it first.", "warn");
      setDeleteFor(null);
      return;
    }
    setParameters(prev => prev.filter(x => x.id !== p.id));
    setDeleteFor(null);
    notify(`Deleted parameter "${p.name}"`);
  }

  if (view === "form") {
    return /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-between mb-4 flex-wrap gap-2" },
        /*#__PURE__*/React.createElement(Button, {
          variant: "outline",
          size: "sm",
          onClick: backToList
        }, /*#__PURE__*/React.createElement(Icon, { name: "arrowLeft", size: 13 }), "Back to List"),
        /*#__PURE__*/React.createElement("div", { className: "text-sm font-semibold", style: { color: C.ink } },
          editingParam ? `Edit Parameter — ${editingParam.name}` : "Add Parameter")
      ),
      /*#__PURE__*/React.createElement(ParameterForm, {
        initial: editingParam,
        onSave: handleSave,
        onCancel: backToList
      })
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = parameters.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!q) return true;
    return [p.code, p.name, p.shortName, p.methodRef].some(v => (v || "").toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-between mb-4 flex-wrap gap-2" },
      /*#__PURE__*/React.createElement("div", { className: "text-sm", style: { color: C.muted } },
        "Define analytical parameters here (code, name, unit, method reference, category, and optional limits). Link them to one or more Test Types in the Test Types sub-tab."),
      /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        onClick: openAdd
      }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 14 }), "+ Add Parameter")
    ),
    /*#__PURE__*/React.createElement("div", { className: "flex gap-2 flex-wrap items-center mb-3" },
      /*#__PURE__*/React.createElement("label", {
        className: "flex items-center gap-1.5 text-xs",
        style: { color: C.muted }
      }, /*#__PURE__*/React.createElement(Icon, { name: "search", size: 13 }),
        /*#__PURE__*/React.createElement("input", {
          value: search,
          onChange: e => { setSearch(e.target.value); setPage(1); },
          placeholder: "Search code, name, method ref…",
          className: "border rounded px-2 py-1 text-xs w-56",
          style: { borderColor: C.border }
        })),
      /*#__PURE__*/React.createElement("select", {
        value: categoryFilter,
        onChange: e => { setCategoryFilter(e.target.value); setPage(1); },
        className: "border rounded px-2 py-1 text-xs",
        style: { borderColor: C.border, color: C.ink }
      }, /*#__PURE__*/React.createElement("option", { value: "" }, "All categories"),
         PARAMETER_CATEGORIES.map(cat => /*#__PURE__*/React.createElement("option", { key: cat, value: cat }, cat)))
    ),
    filtered.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
      icon: "beaker",
      title: parameters.length === 0 ? "No parameters yet" : "No parameters match your search",
      subtitle: parameters.length === 0 ? "Add your first analytical parameter — code, name, unit, and optional limits." : "Try a different code, name, or category.",
      action: parameters.length === 0 ? /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        onClick: openAdd
      }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 13 }), "+ Add Parameter") : undefined
    }),
    filtered.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg overflow-hidden mb-1",
      style: { border: `1px solid ${C.border}` }
    }, /*#__PURE__*/React.createElement("div", { className: "overflow-x-auto max-h-[70vh] overflow-y-auto" },
      /*#__PURE__*/React.createElement("table", { className: "w-full text-sm border-collapse" },
        /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", { style: { background: C.bg } },
          ["Code", "Name", "Short Name", "Unit", "Category", "Method Ref", "TAT (hrs)", ""].map(h =>
            /*#__PURE__*/React.createElement("th", {
              key: h,
              className: "text-left px-3 py-2.5 text-xs font-semibold sticky top-0",
              style: { color: C.muted, background: C.bg, borderBottom: `1px solid ${C.border}`, zIndex: 1 }
            }, h)))),
        /*#__PURE__*/React.createElement("tbody", null, pageRows.map((p, idx) => {
          const usedCount = (testTypes || []).filter(t => (t.linkedParameterIds || []).includes(p.id)).length;
          return /*#__PURE__*/React.createElement("tr", {
            key: p.id,
            style: { borderTop: `1px solid ${C.border}`, background: idx % 2 === 1 ? C.bg : C.card }
          },
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5 font-semibold", style: { color: C.ink } }, p.code),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.ink } }, p.name),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.shortName || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.unit || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5" },
            /*#__PURE__*/React.createElement(Badge, { tone: PARAMETER_CATEGORY_TONE[p.category] || "muted" }, p.category)),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.methodRef || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.tatHours === "" || p.tatHours === undefined || p.tatHours === null ? "—" : p.tatHours),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5 text-right" },
            /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-end gap-1" },
              usedCount > 0 && /*#__PURE__*/React.createElement(Badge, { tone: "info", title: `Linked to ${usedCount} test type(s)` }, usedCount, " test type", usedCount === 1 ? "" : "s"),
              /*#__PURE__*/React.createElement(IconButton, { name: "edit", color: C.teal, title: "Edit parameter", onClick: () => openEdit(p) }),
              /*#__PURE__*/React.createElement(IconButton, { name: "trash", color: C.warn, title: "Delete parameter", onClick: () => setDeleteFor(p) })
            ))
          );
        }))
      )),
      deleteFor && /*#__PURE__*/React.createElement("div", { className: "p-2" },
        /*#__PURE__*/React.createElement(ConfirmBar, {
          text: `Delete parameter "${deleteFor.name}"? This cannot be undone.`,
          onConfirm: () => handleDelete(deleteFor),
          onCancel: () => setDeleteFor(null)
        }))
    ),
    /*#__PURE__*/React.createElement(Pagination, {
      page: pageClamped,
      totalPages: totalPages,
      totalItems: filtered.length,
      pageSize: PAGE_SIZE,
      onPageChange: setPage
    })
  );
}
