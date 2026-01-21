/**
 * Client Fleet Tests
 * 
 * Tests for @udb/client/fleet functionality.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createGroup,
  getGroup,
  listGroups,
  addToGroup,
  removeFromGroup,
  deleteGroup,
  setLabels,
  getLabels,
  findByLabels,
  exportInventory
} from "../src/fleet.js";

const FLEET_CONFIG = path.join(os.homedir(), ".udb", "fleet.json");

describe("Fleet Group Management", () => {
  let backupConfig = null;

  before(() => {
    // Backup existing config
    if (fs.existsSync(FLEET_CONFIG)) {
      backupConfig = fs.readFileSync(FLEET_CONFIG, "utf8");
    }
    // Start fresh
    if (fs.existsSync(FLEET_CONFIG)) {
      fs.unlinkSync(FLEET_CONFIG);
    }
  });

  after(() => {
    // Restore
    if (backupConfig) {
      fs.writeFileSync(FLEET_CONFIG, backupConfig);
    } else if (fs.existsSync(FLEET_CONFIG)) {
      fs.unlinkSync(FLEET_CONFIG);
    }
  });

  describe("createGroup", () => {
    it("should create a group with target objects", () => {
      const result = createGroup("test-group", [
        { host: "192.168.1.1", port: 9910 },
        { host: "192.168.1.2", port: 9910 }
      ]);

      assert.strictEqual(result.group, "test-group");
      assert.strictEqual(result.deviceCount, 2);
    });

    it("should throw on empty targets array", () => {
      assert.throws(() => {
        createGroup("empty-group", []);
      }, Error);
    });

    it("should throw on non-array targets", () => {
      assert.throws(() => {
        createGroup("invalid-group", "not-an-array");
      }, Error);
    });
  });

  describe("getGroup", () => {
    it("should retrieve created group", () => {
      createGroup("retrieve-test", [
        { host: "10.0.0.1", port: 9910 }
      ]);

      const devices = getGroup("retrieve-test");
      assert.strictEqual(devices.length, 1);
      assert.strictEqual(devices[0].host, "10.0.0.1");
    });

    it("should return empty array for non-existent group", () => {
      const devices = getGroup("does-not-exist");
      assert.deepStrictEqual(devices, []);
    });
  });

  describe("listGroups", () => {
    it("should list all groups", () => {
      // Clear and create fresh groups
      if (fs.existsSync(FLEET_CONFIG)) {
        fs.unlinkSync(FLEET_CONFIG);
      }

      createGroup("group-a", [{ host: "1.1.1.1", port: 9910 }]);
      createGroup("group-b", [{ host: "2.2.2.2", port: 9910 }]);

      const groups = listGroups();
      assert.ok(groups.length >= 2);
      
      const names = groups.map(g => g.name);
      assert.ok(names.includes("group-a"));
      assert.ok(names.includes("group-b"));
    });

    it("should include device count in listing", () => {
      createGroup("count-test", [
        { host: "3.3.3.1", port: 9910 },
        { host: "3.3.3.2", port: 9910 },
        { host: "3.3.3.3", port: 9910 }
      ]);

      const groups = listGroups();
      const countTest = groups.find(g => g.name === "count-test");
      
      assert.ok(countTest);
      assert.strictEqual(countTest.deviceCount, 3);
    });
  });

  describe("addToGroup", () => {
    it("should add device to existing group", () => {
      createGroup("add-test", [{ host: "4.4.4.1", port: 9910 }]);
      
      addToGroup("add-test", { host: "4.4.4.2", port: 9910 });
      
      const devices = getGroup("add-test");
      assert.strictEqual(devices.length, 2);
    });

    it("should create group if it does not exist", () => {
      addToGroup("new-group-via-add", { host: "5.5.5.1", port: 9910 });
      
      const devices = getGroup("new-group-via-add");
      assert.strictEqual(devices.length, 1);
    });

    it("should not add duplicate devices", () => {
      createGroup("dup-test", [{ host: "6.6.6.1", port: 9910 }]);
      
      addToGroup("dup-test", { host: "6.6.6.1", port: 9910 });
      addToGroup("dup-test", { host: "6.6.6.1", port: 9910 });
      
      const devices = getGroup("dup-test");
      assert.strictEqual(devices.length, 1);
    });
  });

  describe("removeFromGroup", () => {
    it("should remove device from group", () => {
      createGroup("remove-test", [
        { host: "7.7.7.1", port: 9910 },
        { host: "7.7.7.2", port: 9910 }
      ]);
      
      removeFromGroup("remove-test", { host: "7.7.7.1", port: 9910 });
      
      const devices = getGroup("remove-test");
      assert.strictEqual(devices.length, 1);
      assert.strictEqual(devices[0].host, "7.7.7.2");
    });
  });

  describe("deleteGroup", () => {
    it("should delete entire group", () => {
      createGroup("delete-me", [{ host: "8.8.8.1", port: 9910 }]);
      
      assert.ok(getGroup("delete-me").length > 0);
      
      deleteGroup("delete-me");
      
      assert.strictEqual(getGroup("delete-me").length, 0);
    });
  });
});

describe("Fleet Labels", () => {
  let backupConfig = null;

  before(() => {
    if (fs.existsSync(FLEET_CONFIG)) {
      backupConfig = fs.readFileSync(FLEET_CONFIG, "utf8");
    }
  });

  after(() => {
    if (backupConfig) {
      fs.writeFileSync(FLEET_CONFIG, backupConfig);
    }
  });

  describe("setLabels and getLabels", () => {
    it("should set and get labels for a target", () => {
      const target = { host: "10.10.10.1", port: 9910 };
      
      setLabels(target, { env: "production", role: "webserver" });
      
      const labels = getLabels(target);
      assert.strictEqual(labels.env, "production");
      assert.strictEqual(labels.role, "webserver");
    });

    it("should return empty object for unlabeled target", () => {
      const labels = getLabels({ host: "unlabeled.example.com", port: 9910 });
      assert.deepStrictEqual(labels, {});
    });
  });

  describe("findByLabels", () => {
    it("should find devices matching labels", () => {
      setLabels({ host: "11.11.11.1", port: 9910 }, { env: "test", tier: "frontend" });
      setLabels({ host: "11.11.11.2", port: 9910 }, { env: "test", tier: "backend" });
      setLabels({ host: "11.11.11.3", port: 9910 }, { env: "prod", tier: "frontend" });

      const testDevices = findByLabels({ env: "test" });
      assert.strictEqual(testDevices.length, 2);

      const frontendDevices = findByLabels({ tier: "frontend" });
      assert.strictEqual(frontendDevices.length, 2);

      const testFrontend = findByLabels({ env: "test", tier: "frontend" });
      assert.strictEqual(testFrontend.length, 1);
      assert.strictEqual(testFrontend[0].host, "11.11.11.1");
    });
  });
});

describe("exportInventory", () => {
  it("should export inventory with timestamp", () => {
    const inventory = exportInventory();
    
    assert.ok(inventory.timestamp);
    assert.ok(inventory.groups);
    assert.ok(typeof inventory.groups === "object");
  });
});
