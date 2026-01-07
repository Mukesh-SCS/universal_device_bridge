/**
 * @udb/client/fleet - Fleet-level device management
 * 
 * Provides grouping, labeling, and bulk operations on devices without
 * requiring orchestration infrastructure. Keeps it boring and useful.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execBatch, getConfig, setConfig } from "./index.js";

const CONFIG_FILE = path.join(os.homedir(), ".udb", "fleet.json");

/**
 * Read fleet config
 */
function readFleetConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { groups: {}, labels: {} };
  }
}

/**
 * Write fleet config
 */
function writeFleetConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/**
 * Create a device group (logical collection of targets)
 * @param {string} groupName - Group name
 * @param {Array<object>} targets - Array of target objects
 */
export function createGroup(groupName, targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("targets must be non-empty array");
  }

  const cfg = readFleetConfig();
  cfg.groups = cfg.groups || {};
  cfg.groups[groupName] = targets.map((t) => ({
    host: t.host || t,
    port: t.port || 9910
  }));

  writeFleetConfig(cfg);
  return { group: groupName, deviceCount: targets.length };
}

/**
 * Get devices in a group
 * @param {string} groupName - Group name
 * @returns {Array} Devices in group
 */
export function getGroup(groupName) {
  const cfg = readFleetConfig();
  return cfg.groups?.[groupName] || [];
}

/**
 * List all groups
 * @returns {object} Groups map
 */
export function listGroups() {
  const cfg = readFleetConfig();
  return Object.entries(cfg.groups || {}).map(([name, devices]) => ({
    name,
    deviceCount: devices.length,
    devices
  }));
}

/**
 * Add device(s) to a group
 * @param {string} groupName - Group name
 * @param {Array<object>|object} targets - Target(s) to add
 */
export function addToGroup(groupName, targets) {
  const cfg = readFleetConfig();
  cfg.groups = cfg.groups || {};

  if (!cfg.groups[groupName]) {
    cfg.groups[groupName] = [];
  }

  const targetsArray = Array.isArray(targets) ? targets : [targets];

  for (const t of targetsArray) {
    const normalized = {
      host: t.host || t,
      port: t.port || 9910
    };

    // Check if already exists
    const exists = cfg.groups[groupName].some(
      (d) => d.host === normalized.host && d.port === normalized.port
    );

    if (!exists) {
      cfg.groups[groupName].push(normalized);
    }
  }

  writeFleetConfig(cfg);
  return { group: groupName, deviceCount: cfg.groups[groupName].length };
}

/**
 * Remove device(s) from a group
 * @param {string} groupName - Group name
 * @param {object} target - Target to remove
 */
export function removeFromGroup(groupName, target) {
  const cfg = readFleetConfig();

  if (!cfg.groups?.[groupName]) {
    throw new Error(`Group not found: ${groupName}`);
  }

  cfg.groups[groupName] = cfg.groups[groupName].filter(
    (d) => !(d.host === target.host && d.port === target.port)
  );

  if (cfg.groups[groupName].length === 0) {
    delete cfg.groups[groupName];
  }

  writeFleetConfig(cfg);
}

/**
 * Delete a group
 * @param {string} groupName - Group name
 */
export function deleteGroup(groupName) {
  const cfg = readFleetConfig();

  if (cfg.groups) {
    delete cfg.groups[groupName];
  }

  writeFleetConfig(cfg);
}

/**
 * Set labels on a device
 * @param {object} target - Target device
 * @param {object} labels - Labels object (e.g., { env: "prod", role: "gateway" })
 */
export function setLabels(target, labels) {
  const cfg = readFleetConfig();
  cfg.labels = cfg.labels || {};

  const key = `${target.host}:${target.port}`;
  cfg.labels[key] = { ...cfg.labels[key], ...labels };

  writeFleetConfig(cfg);
  return { device: key, labels: cfg.labels[key] };
}

/**
 * Get labels for a device
 * @param {object} target - Target device
 * @returns {object} Labels object
 */
export function getLabels(target) {
  const cfg = readFleetConfig();
  const key = `${target.host}:${target.port}`;
  return cfg.labels?.[key] || {};
}

/**
 * Find devices by label query
 * @param {object} query - Label query (e.g., { env: "prod" })
 * @returns {Array} Matching devices
 */
export function findByLabels(query) {
  const cfg = readFleetConfig();
  const results = [];

  for (const [key, labels] of Object.entries(cfg.labels || {})) {
    let matches = true;

    for (const [labelKey, labelValue] of Object.entries(query)) {
      if (labels[labelKey] !== labelValue) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const [host, port] = key.split(":");
      results.push({
        host,
        port: Number(port),
        labels
      });
    }
  }

  return results;
}

/**
 * Generate fleet inventory (machine-readable)
 * @returns {object} Inventory with all groups and labels
 */
export function exportInventory() {
  const cfg = readFleetConfig();

  const groups = {};
  for (const [name, devices] of Object.entries(cfg.groups || {})) {
    groups[name] = devices.map((d) => {
      const key = `${d.host}:${d.port}`;
      return {
        ...d,
        labels: cfg.labels?.[key] || {}
      };
    });
  }

  return {
    timestamp: new Date().toISOString(),
    groups,
    devices: Object.entries(cfg.labels || {}).map(([key, labels]) => {
      const [host, port] = key.split(":");
      return { host, port: Number(port), labels };
    })
  };
}

/**
 * Execute command on all devices in a group
 * @param {string} groupName - Group name
 * @param {string} command - Command to execute
 * @param {object} options - Options (parallel, stopOnError)
 * @returns {Promise<Array>} Results
 */
export async function execOnGroup(groupName, command, options = {}) {
  const targets = getGroup(groupName);

  if (targets.length === 0) {
    throw new Error(`Group not found or empty: ${groupName}`);
  }

  return execBatch(targets, command, options);
}

/**
 * Execute command on all devices matching label query
 * @param {object} query - Label query
 * @param {string} command - Command to execute
 * @param {object} options - Options
 * @returns {Promise<Array>} Results
 */
export async function execByLabels(query, command, options = {}) {
  const targets = findByLabels(query);

  if (targets.length === 0) {
    throw new Error("No devices found matching query");
  }

  return execBatch(targets, command, options);
}

export default {
  createGroup,
  getGroup,
  listGroups,
  addToGroup,
  removeFromGroup,
  deleteGroup,
  setLabels,
  getLabels,
  findByLabels,
  execOnGroup,
  execByLabels,
  exportInventory
};
