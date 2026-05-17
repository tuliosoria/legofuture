# LEGO Catalog Overrides

Per-set partial overrides applied last-wins after loading the DDB-backed
catalog. Use this to correct individual records without reshipping the
sync script.

Format: JSON object keyed by `LegoSet.id`. Each value is a partial set
override; supported fields:

```json
{
  "<setId>": {
    "name": "string?",
    "imageUrl": "string?",
    "retirementYear": "number | null?",
    "retired": "boolean?",
    "theme": "LegoTheme?"
  }
}
```

Example:
```json
{
  "75313": {
    "retirementYear": 2024,
    "retired": true
  }
}
```
