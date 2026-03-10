const pipeline = {
  id: "aggie-experts-pipeline",
  body : {
    description: "Adds a modified-date field",
    processors: [
      {
        set: {
          field: "modified-date",
          value: "{{_ingest.timestamp}}"
        }
      }
    ]
  }
};

export default pipeline;