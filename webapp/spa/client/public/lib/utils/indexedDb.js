class IndexedDb {
  /**
   * @method openPreferencesDB
   * @description opens (or creates) the IndexedDB database for app preferences
   * @returns {Promise} resolves to IDBDatabase instance
  */
  openPreferencesDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("app-preferences", 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create an object store the first time
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * @method getElasticsearchIndexes
   * @description retrieves the saved elasticsearch indexes from IndexedDB
   * @returns {Promise} resolves to indexes array or null if not set
   */
  async getElasticsearchIndexes() {
    const db = await this.openPreferencesDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");

      const request = store.get("elasticsearchIndexes");

      request.onsuccess = () => {
        resolve(request.result?.indexes ?? null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * @method setElasticsearchIndexes
   * @description saves the elasticsearch indexes to IndexedDB
   * @param {*} indexes 
   */
  async setElasticsearchIndexes(indexes) {
    const db = await this.openPreferencesDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      const store = tx.objectStore("settings");

      store.put({ indexes }, "elasticsearchIndexes");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * @method deleteElasticsearchIndexes
   * @description deletes the saved elasticsearch indexes from IndexedDB
   */
  async deleteElasticsearchIndexes() {
    const db = await this.openPreferencesDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      const store = tx.objectStore("settings");

      store.delete("elasticsearchIndexes");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

}

module.exports = new IndexedDb();