import React from 'react'
import type {
  SchemaDetail,
  SchemaPropertyDetail,
  SchemaPrimitiveType,
  SchemaPropertyType,
  SchemaUsageTag,
  SchemaCompositionType
} from '@apicaramba/shared-types'
import { buildExampleFromSchemaName } from '../utils/schemaExampleUtils.js'

export function SchemaEditor({
  schema,
  availableSchemas,
  onChange,
  onAddProperty,
  onUpdateProperty,
  onDeleteProperty
}: {
  schema: SchemaDetail
  availableSchemas: SchemaDetail[]
  onChange: (schema: SchemaDetail) => void
  onAddProperty: () => void
  onUpdateProperty: (propertyId: string, patch: Partial<SchemaPropertyDetail>) => void
  onDeleteProperty: (propertyId: string) => void
}): React.JSX.Element {
  const [showPreview, setShowPreview] = React.useState(false)

  const typeOptions: SchemaPropertyType[] = ['string', 'number', 'integer', 'boolean', 'array', 'object']
  const primitiveOptions: SchemaPrimitiveType[] = ['string', 'number', 'integer', 'boolean']
  const compositionOptions: SchemaCompositionType[] = ['allOf', 'anyOf', 'oneOf']
  const schemaOptions = availableSchemas
    .filter((candidate) => candidate.id !== schema.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  const jsonPreviewText = React.useMemo(() => {
    if (!showPreview) return ''
    const schemasByName = new Map(availableSchemas.map((s) => [s.name, s]))
    const example = buildExampleFromSchemaName(schema.name, schemasByName, new Set<string>())
    return JSON.stringify(example, null, 2)
  }, [showPreview, schema, availableSchemas])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Schema Name</span>
          <input
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60 font-mono"
            value={schema.name}
            onChange={(event) => onChange({ ...schema, name: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Description</span>
          <input
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            value={schema.description}
            onChange={(event) => onChange({ ...schema, description: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Usage Tag</span>
          <select
            className="rounded-lg border border-surface-border bg-surface-lower px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary/60"
            value={schema.usageTag ?? 'Both'}
            onChange={(event) => onChange({ ...schema, usageTag: event.target.value as SchemaUsageTag })}
          >
            <option value="Rqst">Request</option>
            <option value="Resp">Response</option>
            <option value="Both">Both</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-lower/60">
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Properties</h4>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-surface-border text-slate-300 hover:bg-surface-raised"
              onClick={() => setShowPreview((prev) => !prev)}
            >
              {showPreview ? 'Hide Preview' : 'Preview JSON'}
            </button>
            <button
              className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-surface-border text-slate-300 hover:bg-surface-raised"
              onClick={onAddProperty}
            >
              + Add Property
            </button>
          </div>
        </div>
        {schema.properties.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">No properties defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-surface-border">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Definition</th>
                  <th className="px-3 py-2 font-medium">Required</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-16" />
                </tr>
              </thead>
              <tbody>
                {schema.properties.map((property) => {
                  const objectSchemaNames = property.objectSchemaNames ?? (property.objectSchemaName ? [property.objectSchemaName] : [])

                  return (
                  <tr key={property.id} className="border-b border-surface-border/70 align-top">
                    <td className="px-3 py-2">
                      {property.name === '' ? (
                        <span className="inline-flex items-center gap-1 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-1 text-xs text-primary/70 italic select-none">
                          (inlined)
                        </span>
                      ) : (
                        <input
                          className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60 font-mono"
                          value={property.name}
                          onChange={(event) => onUpdateProperty(property.id, { name: event.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                        value={property.type}
                        onChange={(event) => {
                          const nextType = event.target.value as SchemaPropertyType
                          if (nextType === 'array') {
                            onUpdateProperty(property.id, {
                              type: nextType,
                              arrayItemType: property.arrayItemType ?? 'string',
                              arrayItemSchemaName: ''
                            })
                            return
                          }

                          if (nextType === 'object') {
                            onUpdateProperty(property.id, {
                              type: nextType,
                              objectSchemaName: property.objectSchemaName ?? '',
                              objectCompositionType: property.objectCompositionType ?? 'allOf',
                              objectSchemaNames: property.objectSchemaNames ?? (property.objectSchemaName ? [property.objectSchemaName] : []),
                              objectDiscriminatorPropertyName: property.objectDiscriminatorPropertyName ?? ''
                            })
                            return
                          }

                          onUpdateProperty(property.id, {
                            type: nextType,
                            arrayItemType: undefined,
                            arrayItemSchemaName: undefined,
                            objectSchemaName: undefined,
                            objectCompositionType: undefined,
                            objectSchemaNames: undefined,
                            objectDiscriminatorPropertyName: undefined
                          })
                        }}
                      >
                        {typeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {property.type === 'array' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                            value={property.arrayItemSchemaName ? 'schema' : 'primitive'}
                            onChange={(event) => {
                              const mode = event.target.value
                              if (mode === 'schema') {
                                onUpdateProperty(property.id, {
                                  arrayItemSchemaName: schemaOptions[0]?.name ?? '',
                                  arrayItemType: undefined
                                })
                              } else {
                                onUpdateProperty(property.id, {
                                  arrayItemSchemaName: '',
                                  arrayItemType: property.arrayItemType ?? 'string'
                                })
                              }
                            }}
                          >
                            <option value="primitive">Primitive</option>
                            <option value="schema">Schema</option>
                          </select>
                          {property.arrayItemSchemaName ? (
                            <select
                              className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                              value={property.arrayItemSchemaName}
                              onChange={(event) => onUpdateProperty(property.id, { arrayItemSchemaName: event.target.value })}
                            >
                              {schemaOptions.length === 0 ? <option value="">No schemas</option> : null}
                              {schemaOptions.map((schemaOption) => (
                                <option key={schemaOption.id} value={schemaOption.name}>{schemaOption.name}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                              value={property.arrayItemType ?? 'string'}
                              onChange={(event) => onUpdateProperty(property.id, { arrayItemType: event.target.value as SchemaPrimitiveType })}
                            >
                              {primitiveOptions.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : property.type === 'object' ? (
                        <div className="flex flex-col gap-2">
                          <select
                            className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                            value={property.objectCompositionType ?? 'allOf'}
                            onChange={(event) => onUpdateProperty(property.id, { objectCompositionType: event.target.value as SchemaCompositionType })}
                          >
                            {compositionOptions.map((composition) => (
                              <option key={composition} value={composition}>{composition}</option>
                            ))}
                          </select>
                          <div className="max-h-24 overflow-y-auto rounded border border-surface-border bg-surface-base p-1.5">
                            {schemaOptions.length === 0 ? (
                              <p className="text-slate-500">No schemas</p>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {schemaOptions.map((schemaOption) => {
                                  const checked = objectSchemaNames.includes(schemaOption.name)
                                  return (
                                    <label key={schemaOption.id} className="inline-flex items-center gap-1.5 text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => {
                                          const nextSchemaNames = event.target.checked
                                            ? [...objectSchemaNames, schemaOption.name]
                                            : objectSchemaNames.filter((name) => name !== schemaOption.name)
                                          onUpdateProperty(property.id, {
                                            objectSchemaNames: nextSchemaNames,
                                            objectSchemaName: nextSchemaNames[0] ?? ''
                                          })
                                        }}
                                      />
                                      <span>{schemaOption.name}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <input
                            className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                            value={property.objectDiscriminatorPropertyName ?? ''}
                            onChange={(event) => onUpdateProperty(property.id, { objectDiscriminatorPropertyName: event.target.value })}
                            placeholder="Discriminator property name (optional)"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={property.required}
                        onChange={(event) => onUpdateProperty(property.id, { required: event.target.checked })}
                        disabled={property.name === ''}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-surface-border bg-surface-base px-2 py-1 text-xs text-slate-100 outline-none focus:border-primary/60"
                        value={property.description}
                        onChange={(event) => onUpdateProperty(property.id, { description: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-slate-500 hover:text-red-300" onClick={() => onDeleteProperty(property.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="rounded-xl border border-surface-border bg-surface-lower/60">
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">JSON Preview</h4>
            <span className="text-xs text-slate-500">Resolved example based on current schema</span>
          </div>
          <pre className="px-4 py-3 text-xs text-slate-200 font-mono overflow-x-auto whitespace-pre max-h-96 overflow-y-auto">{jsonPreviewText}</pre>
        </div>
      )}
    </div>
  )
}
