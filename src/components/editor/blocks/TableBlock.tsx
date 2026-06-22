"use client";

import { useState, useCallback } from "react";

interface TableData {
  headers: string[];
  rows: string[][];
}

interface TableBlockProps {
  data: TableData;
  onChange?: (data: TableData) => void;
  readOnly?: boolean;
}

export function TableBlock({
  data,
  onChange,
  readOnly = false,
}: TableBlockProps) {
  const [editingCell, setEditingCell] = useState<{
    type: "header" | "cell";
    row: number;
    col: number;
  } | null>(null);

  const handleCellChange = useCallback(
    (type: "header" | "cell", row: number, col: number, value: string) => {
      if (!onChange) return;
      const newData = {
        headers: [...data.headers],
        rows: data.rows.map((r) => [...r]),
      };
      if (type === "header") {
        newData.headers[col] = value;
      } else {
        newData.rows[row][col] = value;
      }
      onChange(newData);
    },
    [data, onChange],
  );

  const addRow = useCallback(() => {
    if (!onChange) return;
    const newRow = new Array(data.headers.length).fill("");
    onChange({
      headers: [...data.headers],
      rows: [...data.rows, newRow],
    });
  }, [data, onChange]);

  const addColumn = useCallback(() => {
    if (!onChange) return;
    onChange({
      headers: [...data.headers, ""],
      rows: data.rows.map((row) => [...row, ""]),
    });
  }, [data, onChange]);

  const deleteRow = useCallback(
    (index: number) => {
      if (!onChange) return;
      if (data.rows.length <= 1) return;
      onChange({
        headers: [...data.headers],
        rows: data.rows.filter((_, i) => i !== index),
      });
    },
    [data, onChange],
  );

  const deleteColumn = useCallback(
    (index: number) => {
      if (!onChange) return;
      if (data.headers.length <= 1) return;
      onChange({
        headers: data.headers.filter((_, i) => i !== index),
        rows: data.rows.map((row) => row.filter((_, i) => i !== index)),
      });
    },
    [data, onChange],
  );

  const renderCell = (
    type: "header" | "cell",
    value: string,
    rowIndex: number,
    colIndex: number,
  ) => {
    const isEditing =
      editingCell?.type === type &&
      editingCell?.row === rowIndex &&
      editingCell?.col === colIndex;

    if (isEditing && !readOnly) {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleCellChange(type, rowIndex, colIndex, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditingCell(null);
            if (e.key === "Tab") {
              e.preventDefault();
              setEditingCell(null);
            }
          }}
          className="w-full border-none bg-transparent px-2 py-1 text-sm focus:outline-none"
          autoFocus
        />
      );
    }

    return (
      <span
        onClick={() => {
          if (!readOnly) setEditingCell({ type, row: rowIndex, col: colIndex });
        }}
        className="block cursor-text px-2 py-1 text-sm"
      >
        {value || <span className="text-gray-400">Empty</span>}
      </span>
    );
  };

  return (
    <div className="table-block group relative my-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {data.headers.map((header, i) => (
              <th
                key={i}
                className="relative border-b border-r border-gray-200 bg-gray-50"
              >
                {renderCell("header", header, 0, i)}
                {!readOnly && (
                  <button
                    onClick={() => deleteColumn(i)}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 group-hover:flex"
                    title="Delete column"
                  >
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </th>
            ))}
            {!readOnly && (
              <th className="w-8 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={addColumn}
                  className="flex h-full w-full items-center justify-center text-gray-400 hover:text-gray-600"
                  title="Add column"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="group/row">
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className="border-b border-r border-gray-200"
                >
                  {renderCell("cell", cell, rowIndex, colIndex)}
                </td>
              ))}
              {!readOnly && (
                <td className="w-8 border-b border-gray-200">
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    className="hidden h-full w-full items-center justify-center text-gray-400 hover:text-red-600 group-hover/row:flex"
                    title="Delete row"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <div className="border-t border-gray-200 px-2 py-1">
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add row
          </button>
        </div>
      )}
    </div>
  );
}