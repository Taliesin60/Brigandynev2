(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
  };

  // modules/system/tables-wfrp4e.js
  var WFRP_Tables = class {
    static async rollTable(tableKey, options = {}, column = null) {
      let modifier = options.modifier || 0;
      let minOne = options.minOne || false;
      let table = this.findTable(tableKey.toLowerCase(), column);
      if (table) {
        if (table.columns)
          throw new Error(game.i18n.localize("ERROR.Column"));
        let formula = table.formula;
        let tableSize = Array.from(table.results).length;
        let roll = await new Roll(`${formula} + @modifier`, { modifier }).roll({ async: true });
        if (game.dice3d && !options.hideDSN)
          await game.dice3d.showForRoll(roll);
        let rollValue = options.lookup || roll.total;
        let displayTotal = options.lookup || roll.result;
        if (modifier == 0)
          displayTotal = (0, eval)(displayTotal);
        if (rollValue <= 0 && minOne)
          rollValue = 1;
        else if (rollValue <= 0)
          return {
            roll: rollValue
          };
        let resultList = Array.from(table.results);
        tableSize = resultList.sort((a, b) => a.range[1] - b.range[1])[resultList.length - 1].range[1];
        if (rollValue > tableSize)
          rollValue = tableSize;
        let rollResult = table.getResultsForRoll(rollValue)[0];
        let flags = rollResult.flags.wfrp4e || {};
        let result = {
          result: rollResult.getChatText(),
          roll: displayTotal,
          object: rollResult.toObject(),
          title: table.name
        };
        mergeObject(result, flags);
        if (Object.keys(game.wfrp4e.config.hitLocationTables).includes(tableKey))
          result = this.formatHitloc(rollResult, rollValue);
        return result;
      } else if (tableKey == "hitloc" || tableKey == "scatter") {
        if (tableKey == "scatter") {
          let roll = (await new Roll(`1d10`).roll({ async: true })).total;
          let dist = (await new Roll("2d10").roll({ async: true })).total;
          return { result: this.scatterResult({ roll, dist }), roll };
        } else if (tableKey == "hitloc") {
          let roll = await new Roll(`1d100`).roll();
          let result = this._lookup("hitloc", options.lookup || roll.total);
          result.roll = roll.total;
          return result;
        }
      } else {
        if (tableKey != "menu")
          return ui.notifications.error(game.i18n.localize("ERROR.Table"));
        else
          return this.tableMenu();
      }
    }
    static _lookup(table, value, column = null) {
      if (column && this[table].columns) {
        for (let row of this[table].rows) {
          if (WFRP_Tables._inRange(value, row.range[column]))
            return duplicate(row);
        }
      } else if (column && this[table].multi) {
        for (let row of this[table].rows) {
          if (WFRP_Tables._inRange(value, row.range[column]))
            return duplicate(row[column]);
        }
      } else {
        for (let row of this[table].rows) {
          if (WFRP_Tables._inRange(value, row.range))
            return duplicate(row);
        }
      }
    }
    static _inRange(value, range) {
      if (range.length == 0)
        return false;
      if (range.length == 1)
        range.push(range[0]);
      if (value >= range[0] && value <= range[1])
        return true;
    }
    static generalizeTable(table) {
      table = table.toLowerCase();
      table = table.replace("lleg", "leg");
      table = table.replace("rleg", "leg");
      table = table.replace("rarm", "arm");
      table = table.replace("larm", "arm");
      return table;
    }
    static formatHitloc(result, roll) {
      let flags = result.flags.wfrp4e || {};
      return {
        description: result.getChatText(),
        result: flags.loc,
        roll
      };
    }
    static async rollToChat(table, options = {}, column = null, rollMode) {
      let chatOptions = game.wfrp4e.utility.chatDataSetup("", rollMode, true);
      chatOptions.content = await this.formatChatRoll(table, options, column);
      chatOptions.type = 0;
      if (chatOptions.content)
        ChatMessage.create(chatOptions);
      ui.sidebar.activateTab("chat");
    }
    static findTable(key, column) {
      let tables = game.tables.filter((i) => i.getFlag("wfrp4e", "key") == key);
      if (tables.length > 1 && column)
        return tables.find((i) => i.getFlag("wfrp4e", "column") == column);
      else if (tables.length == 1 || tables.map((t) => t.getFlag("wfrp4e", "column")).filter((t) => t).length < 1)
        return tables[0];
      else if (tables.length)
        return { name: tables[0].name.split("-")[0].trim(), columns: tables };
    }
    static getHitLocTable(key) {
      let hitloc = {};
      let table = this.findTable(key);
      if (table) {
        table.results.forEach((result) => {
          if (result.flags.wfrp4e.loc)
            hitloc[result.flags.wfrp4e.loc] = result.text;
        });
      }
      return hitloc;
    }
    static hitLocKeyToResult(resultKey, tableKey = "hitloc") {
      let table = this.findTable(tableKey);
      if (table) {
        for (let result of table.results) {
          if (result.flags.wfrp4e?.loc == resultKey)
            return this.formatHitloc(result, result.range[0]);
        }
      }
    }
    static async formatChatRoll(table, options = {}, column = null) {
      table = this.generalizeTable(table);
      let tableObject = this.findTable(table, column);
      if (tableObject && tableObject.columns)
        return this.promptColumn(table);
      let result = await this.rollTable(table, options, column);
      if (options.lookup && !game.user.isGM)
        result.roll = game.i18n.localize("TABLE.Lookup") + result.roll;
      try {
        if (result.roll <= 0 && !options.minOne)
          return game.i18n.format("TABLE.Cancel", { result: result.roll });
      } catch {
      }
      if (result.object?.documentCollection && result.object?.documentId) {
        let collection = game.packs.get(result.object.documentCollection);
        if (collection)
          await collection.getDocuments();
        if (!collection)
          collection = game.collections.get(result.object.documentCollection);
        if (collection) {
          let item = collection.get(result.object.documentId);
          if (item && item.documentName == "Item") {
            item.postItem();
            return null;
          }
        }
      }
      return result.result;
    }
    static tableMenu() {
      let tableMenu = `<b><code>/table</code> ${game.i18n.localize("Commands")}</b><br>`;
      let tables = game.tables.filter((i) => i.permission);
      let columnsAdded = [];
      for (let table of tables) {
        let key = table.getFlag("wfrp4e", "key");
        let tableObject = this.findTable(key);
        if (tableObject.columns && !columnsAdded.includes(key)) {
          columnsAdded.push(key);
          tableMenu += `<a data-table='${key}' class='table-click'><i class="fas fa-list"></i> <code>${key}</code></a> - ${tableObject.name}<br>`;
        } else if (tableObject && !tableObject.columns)
          tableMenu += `<a data-table='${key}' class='table-click'><i class="fas fa-list"></i> <code>${key}</code></a> - ${table.name}<br>`;
      }
      return { result: tableMenu };
    }
    static criticalCastMenu(crittable) {
      return `${game.i18n.localize("CHAT.ChooseFrom")}:<ul>
      <li><b>${game.i18n.localize("ROLL.CritCast")}</b>: ${game.i18n.localize("CHAT.CritCast")} <a class=table-click data-table=${crittable}><i class="fas fa-list"></i> ${game.i18n.localize("Critical Wound")}</a></li>
      <li><b>${game.i18n.localize("ROLL.TotalPower")}</b>: ${game.i18n.localize("CHAT.TotalPower")}</li>
      <li><b>${game.i18n.localize("ROLL.UnstoppableForce")}</b>: ${game.i18n.localize("CHAT.UnstoppableForce")}</li>
      </ul`;
    }
    static restrictedCriticalCastMenu() {
      return `${game.i18n.localize("CHAT.MustChoose")}:<ul>
      <li><b>${game.i18n.localize("ROLL.TotalPower")}</b>: ${game.i18n.localize("CHAT.TotalPower")}</li>
      </ul`;
    }
    static promptColumn(table) {
      let prompt = `<h3>${game.i18n.localize("CHAT.ColumnPrompt")}</h3>`;
      let tableObject = this.findTable(table);
      for (let c of tableObject.columns)
        prompt += `<div><a class = "table-click" data-table="${table}" data-column = "${c.getFlag("wfrp4e", "column")}"><i class="fas fa-list"></i> ${c.name}</a></div>`;
      return prompt;
    }
    static scatterResult({ roll, dist }) {
      let tableHtml = `<table class = "scatter-table"> <tr><td position='1'> </td><td position='2'> </td><td position='3'> </td></tr> <tr><td position='4'> </td><td position='10'> T</td><td position='5'> </td></tr> <tr><td position='6'> </td><td position='7'> </td><td position='8'> </td></tr></table>`;
      if (roll == 9)
        tableHtml += game.i18n.localize("CHAT.ScatterYou");
      else if (roll == 10)
        tableHtml += game.i18n.localize("CHAT.ScatterThem");
      else
        tableHtml += game.i18n.localize("CHAT.ScatterNote");
      tableHtml = tableHtml.replace(`position='${roll}'`, "class='selected-position'");
      if (dist && roll <= 8)
        tableHtml = tableHtml.replace("'selected-position'>", `'selected-position'> ${dist} ${game.i18n.localize("yards")}`);
      return tableHtml;
    }
    static get hitloc() {
      return {
        "name": game.i18n.localize("WFRP4E.LocationsTable"),
        "die": "1d100",
        "rows": [{
          "description": game.i18n.localize("WFRP4E.Locations.head"),
          "result": "head",
          "range": [1, 9]
        }, {
          "description": game.i18n.localize("WFRP4E.Locations.lArm"),
          "result": "lArm",
          "range": [10, 24]
        }, {
          "description": game.i18n.localize("WFRP4E.Locations.rArm"),
          "result": "rArm",
          "range": [25, 44]
        }, {
          "description": game.i18n.localize("WFRP4E.Locations.body"),
          "result": "body",
          "range": [45, 79]
        }, {
          "description": game.i18n.localize("WFRP4E.Locations.lLeg"),
          "result": "lLeg",
          "range": [80, 89]
        }, {
          "description": game.i18n.localize("WFRP4E.Locations.rLeg"),
          "result": "rLeg",
          "range": [90, 100]
        }]
      };
    }
    static get scatter() {
      return {
        name: game.i18n.localize("WFRP4E.ScatterTable"),
        die: "1d10",
        rows: [
          {
            name: game.i18n.localize("WFRP4E.Scatter.TopLeft"),
            range: [1, 1]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.TopMiddle"),
            range: [2, 2]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.TopRight"),
            range: [3, 3]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.CenterLeft"),
            range: [4, 4]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.CenterRight"),
            range: [5, 5]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.BottomLeft"),
            range: [6, 6]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.BottomMiddle"),
            range: [7, 7]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.BottomRight"),
            range: [8, 8]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.AtYourFeet"),
            range: [9, 9]
          },
          {
            name: game.i18n.localize("WFRP4E.Scatter.AtTargetFeet"),
            range: [10, 10]
          }
        ]
      };
    }
  };

  // modules/item/item-wfrp4e.js
  var ItemWfrp4e = class extends Item {
    async _preCreate(data, options, user) {
      if (data._id && !this.isOwned)
        options.keepId = WFRP_Utility._keepID(data._id, this);
      let migration = game.wfrp4e.migration.migrateItemData(this);
      if (!isEmpty(migration)) {
        this.updateSource(migration);
        WFRP_Utility.log("Migrating Item: " + this.name, true, migration);
      }
      await super._preCreate(data, options, user);
      if (!data.img || data.img == "icons/svg/item-bag.svg")
        this.updateSource({ img: "systems/wfrp4e/icons/blank.png" });
      if (this.isOwned) {
        if (this.actor.type != "character" && this.actor.type != "vehicle") {
          if (this.type == "armour")
            this.updateSource({ "system.worn.value": true });
          else if (this.type == "weapon")
            this.updateSource({ "system.equipped": true });
          else if (this.type == "trapping" && this.trappingType.value == "clothingAccessories")
            this.updateSource({ "system.worn": true });
          else if (this.type == "spell")
            this.updateSource({ "system.memorized.value": true });
        }
        if (this.type == "vehicleMod" && this.actor.type != "vehicle")
          return false;
        if (getProperty(data, "system.location.value") && data.type != "critical" && data.type != "injury")
          this.updateSource({ "system.location.value": "" });
        if (this.effects.size) {
          let immediateEffects = [];
          let conditions = [];
          this.effects.forEach((e) => {
            if (e.trigger == "oneTime" && e.application == "actor")
              immediateEffects.push(e);
            if (e.isCondition)
              conditions.push(e);
          });
          immediateEffects.forEach((effect) => {
            game.wfrp4e.utility.applyOneTimeEffect(effect, this.actor);
            this.effects.delete(effect.id);
          });
          conditions.forEach((condition) => {
            if (condition.conditionId != "fear") {
              this.actor.addCondition(condition.conditionId, condition.conditionValue);
              this.effects.delete(condition.id);
            }
          });
        }
        if (this.actor.type == "character" && this.type == "spell" && this.lore.value == "petty") {
          WFRP_Utility.memorizeCostDialog(this, this.actor);
        }
        if (this.actor.type == "character" && this.type == "prayer" && this.prayerType.value == "miracle") {
          WFRP_Utility.miracleGainedDialog(this, this.actor);
        }
      }
    }
    async _preUpdate(updateData, options, user) {
      await super._preUpdate(updateData, options, user);
      if (this.type == "weapon" && this.weaponGroup.value == "throwing" && getProperty(updateData, "system.ammunitionGroup.value") == "throwing") {
        delete updateData.system.ammunitionGroup.value;
        return ui.notifications.notify(game.i18n.localize("SHEET.ThrowingAmmoError"));
      }
      if (this.type != "skill" || !this.isOwned || this.grouped.value != "isSpec")
        return;
      if (!updateData.name)
        return;
      let currentCareer = this.actor.currentCareer;
      if (!currentCareer)
        return;
      let careerSkills = duplicate(currentCareer.skills);
      if (careerSkills.includes(this.name))
        careerSkills[careerSkills.indexOf(this.name)] = updateData.name;
      else
        return;
      let oldName = this.name;
      new Dialog({
        title: game.i18n.localize("SHEET.CareerSkill"),
        content: `<p>${game.i18n.localize("SHEET.CareerSkillPrompt")}</p>`,
        buttons: {
          yes: {
            label: game.i18n.localize("Yes"),
            callback: async (dlg) => {
              ui.notifications.notify(`${game.i18n.format("SHEET.CareerSkillNotif", { oldname: oldName, newname: updateData.name, career: currentCareer.name })}`);
              currentCareer.update({ "system.skills": careerSkills });
            }
          },
          no: {
            label: game.i18n.localize("No"),
            callback: async (dlg) => {
              return;
            }
          }
        },
        default: "yes"
      }).render(true);
    }
    prepareData() {
      super.prepareData();
      let functionName = `prepare${this.type[0].toUpperCase() + this.type.slice(1, this.type.length)}`;
      if (this[`${functionName}`])
        this[`${functionName}`]();
    }
    prepareOwnedData() {
      try {
        this.actor.runEffects("prePrepareItem", { item: this });
        let functionName = `prepareOwned${this.type[0].toUpperCase() + this.type.slice(1, this.type.length)}`;
        if (this[`${functionName}`])
          this[`${functionName}`]();
        if (this.encumbrance && this.quantity) {
          if (this.properties?.qualities?.lightweight && this.encumbrance.value >= 1)
            this.encumbrance.value -= 1;
          if (this.properties?.flaws?.bulky)
            this.encumbrance.value += 1;
          this.encumbrance.value = this.encumbrance.value * this.quantity.value;
          if (this.encumbrance.value % 1 != 0)
            this.encumbrance.value = this.encumbrance.value.toFixed(2);
        }
        if (this.isEquipped && this.type != "weapon") {
          this.encumbrance.value = this.encumbrance.value - 1;
          this.encumbrance.value = this.encumbrance.value < 0 ? 0 : this.encumbrance.value;
        }
        this.actor.runEffects("prepareItem", { item: this });
      } catch (e) {
        game.wfrp4e.utility.log(`Something went wrong when preparing actor item ${this.name}: ${e}`);
      }
    }
    prepareAmmunition() {
    }
    prepareOwnedAmmunition() {
    }
    prepareArmour() {
      this.damaged = {
        "head": false,
        "lArm": false,
        "rArm": false,
        "lLeg": false,
        "rLeg": false,
        "body": false
      };
    }
    prepareOwnedArmour() {
    }
    prepareCareer() {
    }
    prepareOwnedCareer() {
    }
    prepareContainer() {
    }
    prepareOwnedContainer() {
      if (!this.countEnc.value)
        this.encumbrance.value = 0;
    }
    prepareCritical() {
    }
    prepareOwnedCritical() {
    }
    prepareDisease() {
    }
    prepareOwnedDisease() {
    }
    prepareInjury() {
    }
    prepareOwnedInjury() {
    }
    prepareMoney() {
    }
    prepareOwnedMoney() {
    }
    prepareMutation() {
    }
    prepareOwnedMutation() {
    }
    preparePrayer() {
    }
    prepareOwnedPrayer() {
      this.prepareOvercastingData();
    }
    preparePsychology() {
    }
    prepareOwnedPsychology() {
    }
    prepareTalent() {
    }
    prepareOwnedTalent() {
      this.advances.indicator = this.advances.force;
    }
    prepareTrapping() {
    }
    prepareOwnedTrapping() {
    }
    prepareSkill() {
    }
    prepareOwnedSkill() {
      this.total.value = this.modifier.value + this.advances.value + this.characteristic.value;
      this.advances.indicator = this.advances.force;
    }
    prepareSpell() {
      this._addSpellDescription();
    }
    prepareOwnedSpell() {
      this.prepareOvercastingData();
      this.cn.value = this.memorized.value ? this.cn.value : this.cn.value * 2;
    }
    prepareTrait() {
    }
    prepareOwnedTrait() {
    }
    prepareWeapon() {
    }
    prepareOwnedWeapon() {
      if (!this.system.infighting) {
        this.qualities.value = foundry.utils.deepClone(this._source.system.qualities.value);
        this.flaws.value = foundry.utils.deepClone(this._source.system.flaws.value);
      }
      if (this.attackType == "ranged" && this.ammo && this.isOwned && this.skillToUse && this.actor.type != "vehicle")
        this._addProperties(this.ammo.properties);
      if (this.weaponGroup.value == "flail" && !this.skillToUse && !this.flaws.value.find((i) => i.name == "dangerous"))
        this.flaws.value.push({ name: "dangerous" });
      if (game.settings.get("wfrp4e", "mooQualities")) {
        game.wfrp4e.utility.logHomebrew("mooQualities");
        let momentum = this.qualities.value.find((q) => q.name == "momentum" && q.value);
        if (momentum?.value && this.actor.status.advantage.value > 0) {
          let qualityString = momentum.value;
          this._addProperties({ qualities: game.wfrp4e.utility.propertyStringToObject(qualityString, game.wfrp4e.utility.allProperties()), flaws: {} });
          this.qualities.value.splice(this.qualities.value.findIndex((q) => q.name == "momentum"), 1);
        }
      }
      this.computeRangeBands();
      if (this.loading) {
        this.loaded.max = 1;
        if (this.repeater) {
          this.loaded.max = this.repeater.value;
          if (!this.loaded.max)
            this.loaded.max = 1;
        }
      }
    }
    prepareExtendedTest() {
    }
    prepareOwnedExtendedTest() {
      this.SL.pct = 0;
      if (this.SL.target > 0)
        this.SL.pct = this.SL.current / this.SL.target * 100;
      if (this.SL.pct > 100)
        this.SL.pct = 100;
      if (this.SL.pct < 0)
        this.SL.pct = 0;
    }
    prepareVehiclemod() {
    }
    prepareOwnedVehiclemod() {
    }
    prepareCargo() {
      if (this.cargoType.value != "wine" && this.cargoType.value != "brandy")
        this.quality.value = "average";
    }
    prepareOwnedCargo() {
    }
    prepareOvercastingData() {
      let usage = {
        range: void 0,
        duration: void 0,
        target: void 0,
        other: void 0
      };
      let target = this.Target;
      let duration = this.Duration;
      let range = this.Range;
      if (parseInt(target)) {
        usage.target = {
          label: game.i18n.localize("Target"),
          count: 0,
          AoE: false,
          initial: parseInt(target) || target,
          current: parseInt(target) || target,
          unit: ""
        };
      } else if (target.includes("AoE")) {
        let aoeValue2 = target.substring(target.indexOf("(") + 1, target.length - 1);
        usage.target = {
          label: game.i18n.localize("AoE"),
          count: 0,
          AoE: true,
          initial: parseInt(aoeValue2) || aoeValue2,
          current: parseInt(aoeValue2) || aoeValue2,
          unit: aoeValue2.split(" ")[1]
        };
      }
      if (parseInt(duration)) {
        usage.duration = {
          label: game.i18n.localize("Duration"),
          count: 0,
          initial: parseInt(duration) || duration,
          current: parseInt(duration) || duration,
          unit: duration.split(" ")[1]
        };
      }
      if (parseInt(range)) {
        usage.range = {
          label: game.i18n.localize("Range"),
          count: 0,
          initial: parseInt(range) || aoeValue,
          current: parseInt(range) || aoeValue,
          unit: range.split(" ")[1]
        };
      }
      if (this.overcast?.enabled) {
        let other = {
          label: this.overcast.label,
          count: 0
        };
        if (this.overcast.initial.type == "value") {
          other.initial = parseInt(this.overcast.initial.value) || 0;
          other.current = parseInt(this.overcast.initial.value) || 0;
        } else if (this.overcast.initial.type == "characteristic") {
          let char = this.actor.characteristics[this.overcast.initial.characteristic];
          if (this.overcast.initial.bonus)
            other.initial = char.bonus;
          else
            other.initial = char.value;
          other.current = other.initial;
        } else if (this.overcast.initial.type == "SL") {
          other.initial = "SL";
          other.current = "SL";
        }
        if (this.overcast.valuePerOvercast.type == "characteristic") {
          let char = this.actor.characteristics[this.overcast.valuePerOvercast.characteristic];
          if (this.overcast.valuePerOvercast.bonus)
            other.increment = char.bonus;
          else
            other.increment = char.value;
        }
        usage.other = other;
      }
      this.overcast.usage = usage;
    }
    async getExpandData(htmlOptions) {
      htmlOptions.async = true;
      const data = this[`_${this.type}ExpandData`]();
      data.description.value = data.description.value || "";
      data.description.value = await TextEditor.enrichHTML(data.description.value, htmlOptions);
      data.targetEffects = this.effects.filter((e) => e.application == "apply");
      data.invokeEffects = this.effects.filter((e) => e.trigger == "invoke");
      return data;
    }
    _trappingExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      let itemProperties = this.Qualities.concat(this.Flaws);
      for (let prop of itemProperties)
        data.properties.push("<a class ='item-property'>" + prop + "</a>");
      return data;
    }
    _moneyExpandData() {
      let data = this.toObject().system;
      data.properties = [`${game.i18n.localize("ITEM.PenniesValue")}: ${this.coinValue.value}`];
      return data;
    }
    _psychologyExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      return data;
    }
    _mutationExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(game.wfrp4e.config.mutationTypes[this.mutationType.value]);
      if (this.modifier.value)
        data.properties.push(this.modifier.value);
      return data;
    }
    _diseaseExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(`<b>${game.i18n.localize("Contraction")}:</b> ${this.contraction.value}`);
      data.properties.push(`<b>${game.i18n.localize("Incubation")}:</b> ${this.incubation.value} ${this.incubation.unit}`);
      data.properties.push(`<b>${game.i18n.localize("Duration")}:</b> ${this.duration.value} ${this.duration.unit}`);
      data.properties = data.properties.concat(this.effects.map((i) => i = "<a class ='symptom-tag'><i class='fas fa-user-injured'></i> " + i.label.trim() + "</a>").join(", "));
      if (this.permanent.value)
        data.properties.push(`<b>${game.i18n.localize("Permanent")}:</b> ${this.permanent.value}`);
      return data;
    }
    _talentExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      return data;
    }
    _traitExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      return data;
    }
    _careerExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(`<b>${game.i18n.localize("Class")}</b>: ${this.class.value}`);
      data.properties.push(`<b>${game.i18n.localize("Group")}</b>: ${this.careergroup.value}`);
      data.properties.push(game.wfrp4e.config.statusTiers[this.status.tier] + " " + this.status.standing);
      data.properties.push(`<b>${game.i18n.localize("Characteristics")}</b>: ${this.characteristics.map((i) => i = " " + game.wfrp4e.config.characteristicsAbbrev[i])}`);
      data.properties.push(`<b>${game.i18n.localize("Skills")}</b>: ${this.skills.map((i) => i = " " + i)}`);
      data.properties.push(`<b>${game.i18n.localize("Talents")}</b>: ${this.talents.map((i) => i = " " + i)}`);
      data.properties.push(`<b>${game.i18n.localize("Trappings")}</b>: ${this.trappings.map((i) => i = " " + i)}`);
      data.properties.push(`<b>${game.i18n.localize("Income")}</b>: ${this.incomeSkill.map((i) => ` <a class = 'career-income' data-career-id=${this.id}> ${this.skills[i]} <i class="fas fa-coins"></i></a>`)}`);
      return data;
    }
    _injuryExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      return data;
    }
    _criticalExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(`<b>${game.i18n.localize("Wounds")}</b>: ${this.wounds.value}`);
      if (this.modifier.value)
        data.properties.push(`<b>${game.i18n.localize("Modifier")}</b>: ${this.modifier.value}`);
      return data;
    }
    _spellExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(`${game.i18n.localize("Range")}: ${this.Range}`);
      let target = this.Target;
      if (target.includes("AoE"))
        target = `<a class='aoe-template'><i class="fas fa-ruler-combined"></i>${target}</a>`;
      data.properties.push(`${game.i18n.localize("Target")}: ${target}`);
      data.properties.push(`${game.i18n.localize("Duration")}: ${this.Duration}`);
      if (this.magicMissile.value)
        data.properties.push(`${game.i18n.localize("Magic Missile")}: +${this.Damage}`);
      else if (this.damage.value || this.damage.dices) {
        let damage = this.Damage || "";
        if (this.damage.dice)
          damage += " + " + this.damage.dice;
        data.properties.push(`${game.i18n.localize("Damage")}: ${damage}`);
      }
      return data;
    }
    _prayerExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      data.properties.push(`${game.i18n.localize("Range")}: ${this.Range}`);
      data.properties.push(`${game.i18n.localize("Target")}: ${this.Target}`);
      data.properties.push(`${game.i18n.localize("Duration")}: ${this.Duration}`);
      let damage = this.Damage || "";
      if (this.damage.dice)
        damage += " + " + this.damage.dice;
      if (this.damage.addSL)
        damage += " + " + game.i18n.localize("SL");
      if (this.damage.value)
        data.properties.push(`${game.i18n.localize("Damage")}: ${this.DamageString}`);
      return data;
    }
    _weaponExpandData() {
      let data = this.toObject().system;
      let properties = [];
      if (this.weaponGroup.value)
        properties.push(game.wfrp4e.config.weaponGroups[this.weaponGroup.value]);
      if (this.range.value)
        properties.push(`${game.i18n.localize("Range")}: ${this.range.value}`);
      if (this.damage.value) {
        let damage = this.damage.value;
        if (this.damage.dice)
          damage += " + " + this.damage.dice;
        properties.push(`${game.i18n.localize("Damage")}: ${damage}`);
      }
      if (this.twohanded.value)
        properties.push(game.i18n.localize("ITEM.TwoHanded"));
      if (this.reach.value)
        properties.push(`${game.i18n.localize("Reach")}: ${game.wfrp4e.config.weaponReaches[this.reach.value] + " - " + game.wfrp4e.config.reachDescription[this.reach.value]}`);
      if (this.damageToItem.value)
        properties.push(`${game.i18n.format("ITEM.WeaponDamaged", { damage: this.damageToItem.value })}`);
      if (this.damageToItem.shield)
        properties.push(`${game.i18n.format("ITEM.ShieldDamaged", { damage: this.damageToItem.shield })}`);
      let itemProperties = this.OriginalQualities.concat(this.OriginalFlaws);
      for (let prop of itemProperties)
        properties.push("<a class ='item-property'>" + prop + "</a>");
      if (this.special.value)
        properties.push(`${game.i18n.localize("Special")}: ` + this.special.value);
      data.properties = properties.filter((p) => !!p);
      return data;
    }
    _armourExpandData() {
      let data = this.toObject().system;
      let properties = [];
      properties.push(game.wfrp4e.config.armorTypes[this.armorType.value]);
      let itemProperties = this.Qualities.concat(this.Flaws);
      for (let prop of itemProperties)
        properties.push("<a class ='item-property'>" + prop + "</a>");
      properties.push(this.penalty.value);
      data.properties = properties.filter((p) => !!p);
      return data;
    }
    _ammunitionExpandData() {
      let data = this.toObject().system;
      let properties = [];
      properties.push(game.wfrp4e.config.ammunitionGroups[this.ammunitionType.value]);
      if (this.range.value)
        properties.push(`${game.i18n.localize("Range")}: ${this.range.value}`);
      if (this.damage.value) {
        let damage = this.damage.value;
        if (this.damage.dice)
          damage += " + " + this.damage.dice;
        properties.push(`${game.i18n.localize("Damage")}: ${damage}`);
      }
      let itemProperties = this.Qualities.concat(this.Flaws);
      for (let prop of itemProperties)
        properties.push("<a class ='item-property'>" + prop + "</a>");
      if (this.special.value)
        properties.push(`${game.i18n.localize("Special")}: ` + this.special.value);
      data.properties = properties.filter((p) => !!p);
      return data;
    }
    _vehicleModExpandData() {
      let data = this.toObject().system;
      data.properties = [game.wfrp4e.config.modTypes[this.modType.value]];
      return data;
    }
    _cargoExpandData() {
      let data = this.toObject().system;
      data.properties = [];
      if (this.origin.value)
        data.properties.push(`<b>${game.i18n.localize("ITEM.Origin")}</b>: ${this.origin.value}`);
      if (game.wfrp4e.config.trade.cargoTypes)
        data.properties.push(`<b>${game.i18n.localize("ITEM.CargoType")}</b>: ${game.wfrp4e.config.trade.cargoTypes[this.cargoType.value]}`);
      if (game.wfrp4e.config.trade.qualities && (this.cargoType.value == "wine" || this.cargoType.value == "brandy"))
        data.properties.push(`<b>${game.i18n.localize("ITEM.CargoQuality")}</b>: ${game.wfrp4e.config.trade.qualities[this.quality.value]}`);
      return data;
    }
    async postItem(quantity) {
      const properties = this[`_${this.type}ChatData`]();
      let postedItem = this.toObject();
      let chatData = duplicate(postedItem);
      chatData["properties"] = properties;
      chatData.hasPrice = "price" in chatData.system && this.type != "cargo";
      if (chatData.hasPrice) {
        if (!chatData.system.price.gc || isNaN(chatData.system.price.gc || 0))
          chatData.system.price.gc = 0;
        if (!chatData.system.price.ss || isNaN(chatData.system.price.ss || 0))
          chatData.system.price.ss = 0;
        if (!chatData.system.price.bp || isNaN(chatData.system.price.bp))
          chatData.system.price.bp = 0;
      }
      let dialogResult;
      if (quantity == void 0 && (this.type == "weapon" || this.type == "armour" || this.type == "ammunition" || this.type == "container" || this.type == "money" || this.type == "trapping")) {
        dialogResult = await new Promise((resolve, reject2) => {
          new Dialog({
            content: `<p>${game.i18n.localize("DIALOG.EnterQuantity")}</p>
          <div class="form-group">
            <label> ${game.i18n.localize("DIALOG.PostQuantity")}</label>
            <input style="width:100px" name="post-quantity" type="number" value="1"/>
          </div>
          <div class="form-group">
          <label> ${game.i18n.localize("DIALOG.ItemQuantity")}</label>
          <input style="width:100px" name="item-quantity" type="number" value="${this.quantity.value}"/>
        </div>
        <p>${game.i18n.localize("DIALOG.QuantityHint")}</p>
          `,
            title: game.i18n.localize("DIALOG.PostQuantity"),
            buttons: {
              post: {
                label: game.i18n.localize("Post"),
                callback: (dlg) => {
                  resolve({
                    post: dlg.find('[name="post-quantity"]').val(),
                    qty: dlg.find('[name="item-quantity"]').val()
                  });
                }
              },
              inf: {
                label: game.i18n.localize("Infinite"),
                callback: (dlg) => {
                  resolve({ post: "inf", qty: dlg.find('[name="item-quantity"]').val() });
                }
              }
            }
          }).render(true);
        });
        if (dialogResult.post != "inf" && (!Number.isNumeric(dialogResult.post) || parseInt(dialogResult.post) <= 0))
          return ui.notifications.error(game.i18n.localize("CHAT.PostError"));
        if (dialogResult.qty != "inf" && (!Number.isNumeric(dialogResult.qty) || parseInt(dialogResult.qty) < 0))
          return ui.notifications.error(game.i18n.localize("CHAT.PostError"));
        let totalQtyPosted = dialogResult.post * dialogResult.qty;
        if (Number.isNumeric(totalQtyPosted)) {
          if (this.isOwned) {
            if (this.quantity.value < totalQtyPosted) {
              return ui.notifications.notify(game.i18n.format("CHAT.PostMoreThanHave"));
            } else {
              ui.notifications.notify(game.i18n.format("CHAT.PostQuantityReduced", { num: totalQtyPosted }));
              this.update({ "system.quantity.value": this.quantity.value - totalQtyPosted });
            }
          }
        }
        if (dialogResult.post != "inf")
          chatData.showQuantity = true;
        chatData.postQuantity = dialogResult.post;
        postedItem.system.quantity.value = dialogResult.qty;
        chatData.system.quantity.value = dialogResult.qty;
      } else if (quantity > 0) {
        chatData.postQuantity = quantity;
        chatData.showQuantity = true;
      }
      if (chatData.img.includes("/blank.png"))
        chatData.img = null;
      renderTemplate("systems/wfrp4e/templates/chat/post-item.html", chatData).then((html) => {
        let chatOptions = WFRP_Utility.chatDataSetup(html);
        chatOptions["flags.transfer"] = JSON.stringify(
          {
            type: "postedItem",
            payload: postedItem
          }
        );
        chatOptions["flags.postQuantity"] = chatData.postQuantity;
        chatOptions["flags.recreationData"] = chatData;
        ChatMessage.create(chatOptions);
      });
    }
    _trappingChatData() {
      let properties = [
        `<b>${game.i18n.localize("ITEM.TrappingType")}</b>: ${game.wfrp4e.config.trappingCategories[this.trappingType.value]}`,
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${this.price.ss || 0} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${this.price.bp || 0} ${game.i18n.localize("MARKET.Abbrev.BP")}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`,
        `<b>${game.i18n.localize("Availability")}</b>: ${game.wfrp4e.config.availability[this.availability.value] || "-"}`
      ];
      if (this.qualities.value.length)
        properties.push(`<b>${game.i18n.localize("Qualities")}</b>: ${this.OriginalQualities.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      if (this.flaws.value.length)
        properties.push(`<b>${game.i18n.localize("Flaws")}</b>: ${this.OriginalFlaws.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      return properties;
    }
    _skillChatData() {
      let properties = [];
      properties.push(this.advanced == "adv" ? `<b>${game.i18n.localize("Advanced")}</b>` : `<b>${game.i18n.localize("Basic")}</b>`);
      return properties;
    }
    _moneyChatData() {
      let properties = [
        `<b>${game.i18n.localize("ITEM.PenniesValue")}</b>: ${this.coinValue.value}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`
      ];
      return properties;
    }
    _psychologyChatData() {
      return [];
    }
    _mutationChatData() {
      let properties = [
        `<b>${game.i18n.localize("ITEM.MutationType")}</b>: ${game.wfrp4e.config.mutationTypes[this.mutationType.value]}`
      ];
      if (this.modifier.value)
        properties.push(`<b>${game.i18n.localize("Modifier")}</b>: ${this.modifier.value}`);
      return properties;
    }
    _diseaseChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Contraction")}:</b> ${this.contraction.value}`);
      properties.push(`<b>${game.i18n.localize("Incubation")}:</b> <a class = 'chat-roll'><i class='fas fa-dice'></i> ${this.incubation.value}</a>`);
      properties.push(`<b>${game.i18n.localize("Duration")}:</b> <a class = 'chat-roll'><i class='fas fa-dice'></i> ${this.duration.value}</a>`);
      properties.push(`<b>${game.i18n.localize("Symptoms")}:</b> ${this.symptoms.value.split(",").map((i) => i = "<a class ='symptom-tag'><i class='fas fa-user-injured'></i> " + i.trim() + "</a>").join(", ")}`);
      if (this.permanent.value)
        properties.push(`<b>${game.i18n.localize("Permanent")}:</b> ${this.permanent.value}`);
      return properties;
    }
    _talentChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Max")}: </b> ${game.wfrp4e.config.talentMax[this.max.value]}`);
      if (this.tests.value)
        properties.push(`<b>${game.i18n.localize("Tests")}: </b> ${this.tests.value}`);
      return properties;
    }
    _traitChatData() {
      let properties = [];
      if (this.specification.value)
        properties.push(`<b>${game.i18n.localize("Specification")}: </b> ${this.specification.value}`);
      return properties;
    }
    _careerChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Class")}</b>: ${this.class.value}`);
      properties.push(`<b>${game.i18n.localize("Group")}</b>: ${this.careergroup.value}`);
      properties.push(`<b>${game.i18n.localize("Status")}</b>: ${game.wfrp4e.config.statusTiers[this.status.tier] + " " + this.status.standing}`);
      properties.push(`<b>${game.i18n.localize("Characteristics")}</b>: ${this.characteristics.map((i) => i = " " + game.wfrp4e.config.characteristicsAbbrev[i])}`);
      properties.push(`<b>${game.i18n.localize("Skills")}</b>: ${this.skills.map((i) => i = " <a class = 'skill-lookup'>" + i + "</a>")}`);
      properties.push(`<b>${game.i18n.localize("Talents")}</b>: ${this.talents.map((i) => i = " <a class = 'talent-lookup'>" + i + "</a>")}`);
      properties.push(`<b>${game.i18n.localize("Trappings")}</b>: ${this.trappings.map((i) => i = " " + i)}`);
      properties.push(`<b>${game.i18n.localize("Income")}</b>: ${this.incomeSkill.map((i) => " " + this.skills[i])}`);
      return properties;
    }
    _injuryChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Location")}</b>: ${this.location.value}`);
      if (this.penalty.value)
        properties.push(`<b>${game.i18n.localize("Penalty")}</b>: ${this.penalty.value}`);
      return properties;
    }
    _criticalChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Wounds")}</b>: ${this.wounds.value}`);
      properties.push(`<b>${game.i18n.localize("Location")}</b>: ${this.location.value}`);
      if (this.modifier.value)
        properties.push(`<b>${game.i18n.localize("Modifier")}</b>: ${this.modifier.value}`);
      return properties;
    }
    _spellChatData() {
      let properties = [];
      if (game.wfrp4e.config.magicLores[this.lore.value])
        properties.push(`<b>${game.i18n.localize("Lore")}</b>: ${game.wfrp4e.config.magicLores[this.lore.value]}`);
      else
        properties.push(`<b>${game.i18n.localize("Lore")}</b>: ${this.lore.value}`);
      properties.push(`<b>${game.i18n.localize("CN")}</b>: ${this.cn.value}`);
      properties.push(`<b>${game.i18n.localize("Range")}</b>: ${this.range.value}`);
      properties.push(`<b>${game.i18n.localize("Target")}</b>: ${this.target.value}`);
      properties.push(`<b>${game.i18n.localize("Duration")}</b>: ${this.duration.value}`);
      if (this.damage.value)
        properties.push(`<b>${game.i18n.localize("Damage")}</b>: ${this.damage.value}`);
      return properties;
    }
    _prayerChatData() {
      let properties = [];
      properties.push(`<b>${game.i18n.localize("Range")}</b>: ${this.range.value}`);
      properties.push(`<b>${game.i18n.localize("Target")}</b>: ${this.target.value}`);
      properties.push(`<b>${game.i18n.localize("Duration")}</b>: ${this.duration.value}`);
      if (this.damage.value)
        properties.push(`<b>${game.i18n.localize("Damage")}</b>: ${this.damage.value}`);
      return properties;
    }
    _containerChatData() {
      let properties = [
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} GC, ${this.price.ss || 0} SS, ${this.price.bp || 0} BP`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`,
        `<b>${game.i18n.localize("Availability")}</b>: ${game.wfrp4e.config.availability[this.availability.value] || "-"}`
      ];
      properties.push(`<b>${game.i18n.localize("Wearable")}</b>: ${this.wearable.value ? game.i18n.localize("Yes") : game.i18n.localize("No")}`);
      properties.push(`<b>${game.i18n.localize("ITEM.CountOwnerEnc")}</b>: ${this.countEnc.value ? game.i18n.localize("Yes") : game.i18n.localize("No")}`);
      return properties;
    }
    _weaponChatData() {
      let properties = [
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${this.price.ss || 0} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${this.price.bp || 0} ${game.i18n.localize("MARKET.Abbrev.BP")}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`,
        `<b>${game.i18n.localize("Availability")}</b>: ${game.wfrp4e.config.availability[this.availability.value] || "-"}`
      ];
      if (this.weaponGroup.value)
        properties.push(`<b>${game.i18n.localize("Group")}</b>: ${game.wfrp4e.config.weaponGroups[this.weaponGroup.value]}`);
      if (this.range.value)
        properties.push(`<b>${game.i18n.localize("Range")}</b>: ${this.range.value}`);
      if (this.damage.value)
        properties.push(`<b>${game.i18n.localize("Damage")}</b>: ${this.damage.value}`);
      if (this.twohanded.value)
        properties.push(`<b>${game.i18n.localize("ITEM.TwoHanded")}</b>`);
      if (this.reach.value)
        properties.push(`<b>${game.i18n.localize("Reach")}</b>: ${game.wfrp4e.config.weaponReaches[this.reach.value] + " - " + game.wfrp4e.config.reachDescription[this.reach.value]}`);
      if (this.damageToItem.value)
        properties.push(`${game.i18n.format("ITEM.WeaponDamaged", { damage: this.damageToItem.value })}`);
      if (this.damageToItem.shield)
        properties.push(`${game.i18n.format("ITEM.ShieldDamaged", { damage: this.damageToItem.shield })}`);
      if (this.qualities.value.length)
        properties.push(`<b>${game.i18n.localize("Qualities")}</b>: ${this.OriginalQualities.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      if (this.flaws.value.length)
        properties.push(`<b>${game.i18n.localize("Flaws")}</b>: ${this.OriginalFlaws.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      properties = properties.filter((p) => p != game.i18n.localize("Special"));
      if (this.special.value)
        properties.push(`<b>${game.i18n.localize("Special")}</b>: ` + this.special.value);
      properties = properties.filter((p) => !!p);
      return properties;
    }
    _armourChatData() {
      let properties = [
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${this.price.ss || 0} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${this.price.bp || 0} ${game.i18n.localize("MARKET.Abbrev.BP")}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`,
        `<b>${game.i18n.localize("Availability")}</b>: ${game.wfrp4e.config.availability[this.availability.value] || "-"}`
      ];
      if (this.armorType.value)
        properties.push(`<b>${game.i18n.localize("ITEM.ArmourType")}</b>: ${game.wfrp4e.config.armorTypes[this.armorType.value]}`);
      if (this.penalty.value)
        properties.push(`<b>${game.i18n.localize("Penalty")}</b>: ${this.penalty.value}`);
      for (let loc in game.wfrp4e.config.locations)
        if (this.AP[loc])
          properties.push(`<b>${game.wfrp4e.config.locations[loc]} AP</b>: ${this.currentAP[loc]}/${this.AP[loc]}`);
      if (this.qualities.value.length)
        properties.push(`<b>${game.i18n.localize("Qualities")}</b>: ${this.OriginalQualities.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      if (this.flaws.value.length)
        properties.push(`<b>${game.i18n.localize("Flaws")}</b>: ${this.OriginalFlaws.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      properties = properties.filter((p) => p != game.i18n.localize("Special"));
      if (this.special.value)
        properties.push(`<b>${game.i18n.localize("Special")}</b>: ` + this.special.value);
      properties = properties.filter((p) => !!p);
      return properties;
    }
    _ammunitionChatData() {
      let properties = [
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${this.price.ss || 0} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${this.price.bp || 0} ${game.i18n.localize("MARKET.Abbrev.BP")}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`,
        `<b>${game.i18n.localize("Availability")}</b>: ${game.wfrp4e.config.availability[this.availability.value] || "-"}`
      ];
      properties.push(`<b>${game.i18n.localize("ITEM.AmmunitionType")}:</b> ${game.wfrp4e.config.ammunitionGroups[this.ammunitionType.value]}`);
      if (this.range.value)
        properties.push(`<b>${game.i18n.localize("Range")}</b>: ${this.range.value}`);
      if (this.damage.value)
        properties.push(`<b>${game.i18n.localize("Damage")}</b>: ${this.damage.value}`);
      if (this.qualities.value.length)
        properties.push(`<b>${game.i18n.localize("Qualities")}</b>: ${this.OriginalQualities.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      if (this.flaws.value.length)
        properties.push(`<b>${game.i18n.localize("Flaws")}</b>: ${this.OriginalFlaws.map((i) => i = "<a class ='item-property'>" + i + "</a>").join(", ")}`);
      properties = properties.filter((p) => p != game.i18n.localize("Special"));
      if (this.special.value)
        properties.push(`<b>${game.i18n.localize("Special")}</b>: ` + this.special.value);
      properties = properties.filter((p) => !!p);
      return properties;
    }
    _extendedTestChatData() {
      let properties = [];
      let pct = 0;
      if (this.SL.target > 0)
        pct = this.SL.current / this.SL.target * 100;
      if (pct > 100)
        pct = 100;
      if (pct < 0)
        pct = 0;
      properties.push(`<b>${game.i18n.localize("Test")}</b>: ${this.test.value}`);
      if (!this.hide.test && !this.hide.progress)
        properties.push(`<div class="test-progress">
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${pct}%"></div>
      </div>
      <span><a class="extended-SL">${this.SL.current}</a> / ${this.SL.target} SL</span>
    </div>`);
      return properties;
    }
    _vehicleModChatData() {
      let properties = [
        `<b>${game.i18n.localize("VEHICLE.ModType")}</b>: ${game.wfrp4e.config.modTypes[this.modType.value]}`,
        `<b>${game.i18n.localize("Price")}</b>: ${this.price.gc || 0} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${this.price.ss || 0} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${this.price.bp || 0} ${game.i18n.localize("MARKET.Abbrev.BP")}`,
        `<b>${game.i18n.localize("Encumbrance")}</b>: ${this.encumbrance.value}`
      ];
      return properties;
    }
    _cargoChatData() {
      let properties = [];
      if (this.origin.value)
        properties.push(`<b>${game.i18n.localize("ITEM.Origin")}</b>: ${this.origin.value}`);
      if (game.wfrp4e.config.trade.cargoTypes)
        properties.push(`<b>${game.i18n.localize("ITEM.CargoType")}</b>: ${game.wfrp4e.config.trade.cargoTypes[this.cargoType.value]}`);
      if (game.wfrp4e.config.trade.qualities && (this.cargoType.value == "wine" || this.cargoType.value == "brandy"))
        properties.push(`<b>${game.i18n.localize("ITEM.CargoQuality")}</b>: ${game.wfrp4e.config.trade.qualities[this.quality.value]}`);
      return properties;
    }
    applyAmmoMods(value, type) {
      if (this.ammo?.type == "weapon" && type == "damage") {
        return Number(this.ammo.damage.value);
      }
      if (!this.ammo || this.ammo.type == "weapon")
        return value;
      let ammoValue = this.ammo[type].value;
      if (!ammoValue)
        return value;
      if (ammoValue.toLowerCase() == game.i18n.localize("as weapon")) {
      } else if (ammoValue.toLowerCase() == "as weapon") {
      } else if (ammoValue.toLowerCase() == game.i18n.localize("half weapon"))
        value /= 2;
      else if (ammoValue.toLowerCase() == "half weapon")
        value /= 2;
      else if (ammoValue.toLowerCase() == game.i18n.localize("third weapon"))
        value /= 3;
      else if (ammoValue.toLowerCase() == "third weapon")
        value /= 3;
      else if (ammoValue.toLowerCase() == game.i18n.localize("quarter weapon"))
        value /= 4;
      else if (ammoValue.toLowerCase() == "quarter weapon")
        value /= 4;
      else if (ammoValue.toLowerCase() == game.i18n.localize("twice weapon"))
        value *= 2;
      else if (ammoValue.toLowerCase() == "twice weapon")
        value *= 2;
      else {
        try {
          ammoValue = (0, eval)(ammoValue);
          value = Math.floor((0, eval)(value + ammoValue));
        } catch {
          value = Math.floor((0, eval)(value + ammoRange));
        }
      }
      return value;
    }
    computeSpellPrayerFormula(type, aoe = false, formulaOverride) {
      try {
        let formula = formulaOverride || this[type]?.value;
        if (Number.isNumeric(formula))
          return formula;
        formula = formula.toLowerCase();
        if (formula != game.i18n.localize("You").toLowerCase() && formula != game.i18n.localize("Special").toLowerCase() && formula != game.i18n.localize("Instant").toLowerCase()) {
          for (let ch in this.actor.characteristics) {
            formula = formula.replace(game.wfrp4e.config.characteristicsBonus[ch].toLowerCase(), this.actor.characteristics[ch].bonus);
            formula = formula.replace(game.wfrp4e.config.characteristics[ch].toLowerCase(), this.actor.characteristics[ch].value);
          }
        }
        if (aoe)
          formula = "AoE (" + formula.capitalize() + ")";
        return formula.capitalize();
      } catch (e) {
        WFRP_Utility.log("Error computing spell or prayer formula", true, this);
        return 0;
      }
    }
    computeSpellDamage(formula, isMagicMissile) {
      try {
        formula = formula.toLowerCase();
        if (isMagicMissile) {
          formula += "+ " + this.actor.characteristics["wp"].bonus;
        }
        for (let ch in this.actor.characteristics) {
          formula = formula.replace(game.wfrp4e.config.characteristicsBonus[ch].toLowerCase(), this.actor.characteristics[ch].bonus);
          formula = formula.replace(game.wfrp4e.config.characteristics[ch].toLowerCase(), this.actor.characteristics[ch].value);
        }
        return (0, eval)(formula);
      } catch (e) {
        throw ui.notifications.error(game.i18n.format("ERROR.ParseSpell"));
      }
    }
    computeWeaponFormula(type, mount) {
      let formula = this[type].value || 0;
      let actorToUse = this.actor;
      try {
        formula = formula.toLowerCase();
        for (let ch in this.actor.characteristics) {
          if (ch == "s" && mount)
            actorToUse = mount;
          else
            actorToUse = this.actor;
          if (formula.includes(ch.concat("b"))) {
            formula = formula.replace(ch.concat("b"), actorToUse.characteristics[ch].bonus.toString());
          }
        }
        formula = formula.replace("x", "*");
        return (0, eval)(formula);
      } catch {
        return formula;
      }
    }
    computeRangeBands() {
      let range = this.Range;
      if (!range || this.attackType == "melee")
        return;
      let rangeBands = {};
      rangeBands[`${game.i18n.localize("Point Blank")}`] = {
        range: [0, Math.ceil(range / 10)],
        modifier: game.wfrp4e.config.difficultyModifiers[game.wfrp4e.config.rangeModifiers["Point Blank"]],
        difficulty: game.wfrp4e.config.rangeModifiers["Point Blank"]
      };
      rangeBands[`${game.i18n.localize("Short Range")}`] = {
        range: [Math.ceil(range / 10) + 1, Math.ceil(range / 2)],
        modifier: game.wfrp4e.config.difficultyModifiers[game.wfrp4e.config.rangeModifiers["Short Range"]],
        difficulty: game.wfrp4e.config.rangeModifiers["Short Range"]
      };
      rangeBands[`${game.i18n.localize("Normal")}`] = {
        range: [Math.ceil(range / 2) + 1, range],
        modifier: game.wfrp4e.config.difficultyModifiers[game.wfrp4e.config.rangeModifiers["Normal"]],
        difficulty: game.wfrp4e.config.rangeModifiers["Normal"]
      };
      rangeBands[`${game.i18n.localize("Long Range")}`] = {
        range: [range + 1, range * 2],
        modifier: game.wfrp4e.config.difficultyModifiers[game.wfrp4e.config.rangeModifiers["Long Range"]],
        difficulty: game.wfrp4e.config.rangeModifiers["Long Range"]
      };
      rangeBands[`${game.i18n.localize("Extreme")}`] = {
        range: [range * 2 + 1, range * 3],
        modifier: game.wfrp4e.config.difficultyModifiers[game.wfrp4e.config.rangeModifiers["Extreme"]],
        difficulty: game.wfrp4e.config.rangeModifiers["Extreme"]
      };
      if (game.settings.get("wfrp4e", "mooRangeBands")) {
        game.wfrp4e.utility.logHomebrew("mooRangeBands");
        if (!this.getFlag("wfrp4e", "optimalRange"))
          game.wfrp4e.utility.log("Warning: No Optimal Range set for " + this.name);
        rangeBands[`${game.i18n.localize("Point Blank")}`].modifier = game.wfrp4e.utility.optimalDifference(this, game.i18n.localize("Point Blank")) * -20 + 20;
        delete rangeBands[`${game.i18n.localize("Point Blank")}`].difficulty;
        rangeBands[`${game.i18n.localize("Short Range")}`].modifier = game.wfrp4e.utility.optimalDifference(this, game.i18n.localize("Short Range")) * -20 + 20;
        delete rangeBands[`${game.i18n.localize("Short Range")}`].difficulty;
        rangeBands[`${game.i18n.localize("Normal")}`].modifier = game.wfrp4e.utility.optimalDifference(this, game.i18n.localize("Normal")) * -20 + 20;
        delete rangeBands[`${game.i18n.localize("Normal")}`].difficulty;
        rangeBands[`${game.i18n.localize("Long Range")}`].modifier = game.wfrp4e.utility.optimalDifference(this, game.i18n.localize("Long Range")) * -20 + 20;
        delete rangeBands[`${game.i18n.localize("Long Range")}`].difficulty;
        rangeBands[`${game.i18n.localize("Extreme")}`].modifier = game.wfrp4e.utility.optimalDifference(this, game.i18n.localize("Extreme")) * -20 + 20;
        delete rangeBands[`${game.i18n.localize("Extreme")}`].difficulty;
      }
      if (this.weaponGroup.value == "entangling") {
        rangeBands[`${game.i18n.localize("Point Blank")}`].modifier = 0;
        rangeBands[`${game.i18n.localize("Short Range")}`].modifier = 0;
        rangeBands[`${game.i18n.localize("Normal")}`].modifier = 0;
        rangeBands[`${game.i18n.localize("Long Range")}`].modifier = 0;
        rangeBands[`${game.i18n.localize("Extreme")}`].modifier = 0;
      }
      this.range.bands = rangeBands;
    }
    _addProperties(properties) {
      let qualities = this.qualities.value;
      let flaws = this.flaws.value;
      for (let q in properties.qualities) {
        let hasQuality = qualities.find((quality) => quality.name == q);
        if (hasQuality && properties.qualities[q].value) {
          hasQuality.value += properties.qualities[q].value;
        } else
          qualities.push({ name: q, value: properties.qualities[q].value });
      }
      for (let f in properties.flaws) {
        let hasQuality = flaws.find((flaw) => flaw.name == f);
        if (hasQuality && properties.flaws[f].value) {
          hasQuality.value += properties.flaws[f].value;
        } else
          flaws.push({ name: f, value: properties.flaws[f].value });
      }
    }
    static _propertyArrayToObject(array, propertyObject) {
      let properties = {};
      if (array) {
        array.forEach((p) => {
          if (propertyObject[p.name]) {
            properties[p.name] = {
              key: p.name,
              display: propertyObject[p.name],
              value: p.value
            };
            if (p.value)
              properties[p.name].display += " " + (Number.isNumeric(p.value) ? p.value : `(${p.value})`);
          } else if (p.custom) {
            properties[p.key] = {
              key: p.key,
              display: p.display
            };
          } else
            properties[p.name] = {
              key: p.name,
              display: p.name
            };
        });
      }
      return properties;
    }
    _addAPLayer(AP) {
      for (let loc in this.currentAP) {
        if (this.currentAP[loc] > 0) {
          AP[loc].value += this.currentAP[loc];
          let layer = {
            value: this.currentAP[loc],
            armourType: this.armorType.value
          };
          let properties = this.properties;
          layer.impenetrable = !!properties.qualities.impenetrable;
          layer.partial = !!properties.flaws.partial;
          layer.weakpoints = !!properties.flaws.weakpoints;
          if (this.armorType.value == "plate" || this.armorType.value == "mail")
            layer.metal = true;
          AP[loc].layers.push(layer);
        }
      }
    }
    _addCareerData(career) {
      if (!career)
        return;
      this.advances.career = this;
      if (this.type == "skill") {
        if (this.advances.value >= career.level.value * 5)
          this.advances.complete = true;
      }
      this.advances.indicator = this.advances.indicator || !!this.advances.career || false;
    }
    _addSpellDescription() {
      let description = this.description.value;
      if (description && description.includes(game.i18n.localize("SPELL.Lore")))
        return description;
      if (this.lore.effect)
        description += `<p>

 <b>${game.i18n.localize("SPELL.Lore")}</b> ${this.lore.effect}<p>`;
      else if (game.wfrp4e.config.loreEffectDescriptions && game.wfrp4e.config.loreEffectDescriptions[this.lore.value])
        description += `<p>

 <b>${game.i18n.localize("SPELL.Lore")}</b> ${game.wfrp4e.config.loreEffectDescriptions[this.lore.value]}<p>`;
      this.description.value = description;
    }
    async addCondition(effect, value = 1) {
      if (typeof effect === "string")
        effect = duplicate(game.wfrp4e.config.statusEffects.find((e) => e.id == effect));
      if (!effect)
        return "No Effect Found";
      if (!effect.id)
        return "Conditions require an id field";
      let existing = this.hasCondition(effect.id);
      if (existing && existing.flags.wfrp4e.value == null)
        return existing;
      else if (existing) {
        existing = duplicate(existing);
        existing.flags.wfrp4e.value += value;
        return this.updateEmbeddedDocuments("ActiveEffect", [existing]);
      } else if (!existing) {
        effect.label = game.i18n.localize(effect.label);
        if (Number.isNumeric(effect.flags.wfrp4e.value))
          effect.flags.wfrp4e.value = value;
        effect["flags.core.statusId"] = effect.id;
        delete effect.id;
        return this.createEmbeddedDocuments("ActiveEffect", [effect]);
      }
    }
    async removeCondition(effect, value = 1) {
      if (typeof effect === "string")
        effect = duplicate(game.wfrp4e.config.statusEffects.find((e) => e.id == effect));
      if (!effect)
        return "No Effect Found";
      if (!effect.id)
        return "Conditions require an id field";
      let existing = this.hasCondition(effect.id);
      if (existing && existing.flags.wfrp4e.value == null)
        return this.deleteEmbeddedDocuments("ActiveEffect", [existing._id]);
      else if (existing) {
        existing.flags.wfrp4e.value -= value;
        if (existing.flags.wfrp4e.value <= 0)
          return this.deleteEmbeddedDocuments("ActiveEffect", [existing._id]);
        else
          return this.updateEmbeddedDocuments("ActiveEffect", [existing]);
      }
    }
    hasCondition(conditionKey) {
      let existing = this.effects.find((i) => i.statusId == conditionKey);
      return existing;
    }
    get isMelee() {
      return this.modeOverride?.value == "melee" || game.wfrp4e.config.groupToType[this.weaponGroup.value] == "melee" && this.modeOverride?.value != "ranged";
    }
    get isRanged() {
      return this.modeOverride?.value == "ranged" || game.wfrp4e.config.groupToType[this.weaponGroup.value] == "ranged" && this.modeOverride?.value != "melee";
    }
    get isEquipped() {
      if (this.type == "armour" || this.type == "container")
        return !!this.worn.value;
      else if (this.type == "weapon")
        return !!this.equipped;
      else if (this.type == "trapping" && this.trappingType.value == "clothingAccessories")
        return !!this.worn;
    }
    get WeaponGroup() {
      return game.wfrp4e.config.weaponGroups[this.weaponGroup.value];
    }
    get Reach() {
      return game.wfrp4e.config.weaponReaches[this.reach.value];
    }
    get Max() {
      switch (this.max.value) {
        case "1":
          return 1;
        case "2":
          return 2;
        case "3":
          return 3;
        case "4":
          return 4;
        case "none":
          return "-";
        default:
          return this.actor.characteristics[this.max.value].bonus;
      }
    }
    get DisplayName() {
      return this.specification.value ? this.name + " (" + this.Specification + ")" : this.name;
    }
    get attackType() {
      if (this.type == "weapon")
        return this.modeOverride?.value || game.wfrp4e.config.groupToType[this.weaponGroup.value];
      else if (this.type == "trait" && this.rollable.damage)
        return this.rollable.attackType;
    }
    get hasTargetedOrInvokeEffects() {
      let targetEffects = this.effects.filter((e) => e.application == "apply");
      let invokeEffects = this.effects.filter((e) => e.trigger == "invoke");
      return targetEffects.length > 0 || invokeEffects.length > 0;
    }
    get cost() {
      if (this.type == "talent")
        return (this.Advances + 1) * 100;
      else if (this.type == "skill") {
        return WFRP_Utility._calculateAdvCost(this.advances.value, "skill", this.advances.costModifier);
      }
    }
    get included() {
      return !(this.actor.excludedTraits || []).includes(this.id);
    }
    get reachNum() {
      return game.wfrp4e.config.reachNum[this.reach.value];
    }
    get ammo() {
      if (this.attackType == "ranged" && this.currentAmmo?.value && this.isOwned)
        return this.actor.items.get(this.currentAmmo.value);
    }
    get ammoList() {
      if (this.ammunitionGroup.value == "throwing")
        return this.actor.getItemTypes("weapon").filter((i) => i.weaponGroup.value == "throwing");
      else
        return this.actor.getItemTypes("ammunition").filter((a) => a.ammunitionType.value == this.ammunitionGroup.value);
    }
    get ingredient() {
      if (this.currentIng.value)
        return this.actor.items.get(this.currentIng.value);
    }
    get ingredientList() {
      return this.actor.getItemTypes("trapping").filter((t) => t.trappingType.value == "ingredient" && t.spellIngredient.value == this.id);
    }
    get skillToUse() {
      let skills = this.actor.getItemTypes("skill");
      let skill;
      if (this.type == "weapon") {
        skill = skills.find((x) => x.name.toLowerCase() == this.skill.value.toLowerCase());
        if (!skill)
          skill = skills.find((x) => x.name.toLowerCase().includes(`(${this.WeaponGroup.toLowerCase()})`));
      }
      if (this.type == "spell") {
        if (this.skill.value) {
          skill = skills.find((i) => i.name.toLowerCase() == this.skill.value.toLowerCase());
        }
        if (!skill) {
          skill = skills.find((i) => i.name.toLowerCase() == `${game.i18n.localize("NAME.Language")} (${game.i18n.localize("SPEC.Magick")})`.toLowerCase());
        }
      }
      if (this.type == "prayer")
        skill = skills.find((i) => i.name.toLowerCase() == game.i18n.localize("NAME.Pray").toLowerCase());
      if (this.type == "trait" && this.rollable.value && this.rollable.skill)
        skill = skills.find((i) => i.name == this.rollable.skill);
      return skill;
    }
    get loading() {
      return this.properties.flaws.reload;
    }
    get repeater() {
      return this.properties.qualities.repeater;
    }
    get reloadingTest() {
      return this.actor.items.get(getProperty(this.data, "flags.wfrp4e.reloading"));
    }
    get protects() {
      let protects = {};
      for (let loc in this.AP) {
        if (this.AP[loc] > 0)
          protects[loc] = true;
        else
          protects[loc] = false;
      }
      return protects;
    }
    get properties() {
      if (!this.qualities || !this.flaws) {
        return {};
      }
      let properties = {
        qualities: ItemWfrp4e._propertyArrayToObject(this.qualities.value, game.wfrp4e.utility.qualityList()),
        flaws: ItemWfrp4e._propertyArrayToObject(this.flaws.value, game.wfrp4e.utility.flawList()),
        unusedQualities: {}
      };
      if (this.type == "weapon" && this.isOwned && !this.skillToUse && this.actor.type != "vehicle") {
        properties.unusedQualities = properties.qualities;
        properties.qualities = {};
        if (this.ammo)
          properties.qualities = this.ammo.properties.qualities;
      }
      properties.special = this.special?.value;
      if (this.ammo)
        properties.specialAmmo = this.ammo.properties.special;
      return properties;
    }
    get originalProperties() {
      let properties = {
        qualities: ItemWfrp4e._propertyArrayToObject(this._source.system.qualities.value, game.wfrp4e.utility.qualityList()),
        flaws: ItemWfrp4e._propertyArrayToObject(this._source.system.flaws.value, game.wfrp4e.utility.flawList()),
        unusedQualities: {}
      };
      return properties;
    }
    get skillModified() {
      if (this.modifier) {
        if (this.modifier.value > 0)
          return "positive";
        else if (this.modifier.value < 0)
          return "negative";
      }
      return "";
    }
    get Advances() {
      if (this.isOwned) {
        let talents = this.actor.getItemTypes("talent");
        return talents.filter((i) => i.name == this.name).reduce((prev, current) => prev += current.advances.value, 0);
      } else {
        return this.advances.value;
      }
    }
    get Qualities() {
      return Object.values(this.properties.qualities).map((q) => q.display);
    }
    get UnusedQualities() {
      return Object.values(this.properties.unusedQualities).map((q) => q.display);
    }
    get Flaws() {
      return Object.values(this.properties.flaws).map((f) => f.display);
    }
    get OriginalQualities() {
      return Object.values(this.originalProperties.qualities).map((q) => q.display);
    }
    get OriginalFlaws() {
      return Object.values(this.originalProperties.flaws).map((f) => f.display);
    }
    get Target() {
      return this.computeSpellPrayerFormula("target", this.target.aoe);
    }
    get Duration() {
      let duration = this.computeSpellPrayerFormula("duration", this.range.aoe);
      if (this.duration.extendable)
        duration += "+";
      return duration;
    }
    get Range() {
      if (this.type == "spell" || this.type == "prayer")
        return this.computeSpellPrayerFormula("range");
      else if (this.type == "weapon")
        return this.applyAmmoMods(this.computeWeaponFormula("range"), "range");
    }
    get Damage() {
      let damage;
      if (this.type == "spell")
        damage = this.computeSpellDamage(this.damage.value, this.magicMissile.value);
      else if (this.type == "prayer")
        damage = this.computeSpellDamage(this.damage.value, false);
      else if (this.type == "weapon")
        damage = this.applyAmmoMods(this.computeWeaponFormula("damage"), "damage") + (this.actor.flags[`${this.attackType}DamageIncrease`] || 0) - Math.max(this.damageToItem.value - (this.properties.qualities.durable?.value || 0), 0);
      else if (this.type == "trait" && this.rollable.damage)
        damage = this.Specification;
      if (game.settings.get("wfrp4e", "mooSizeDamage") && this.actor.sizeNum > 3) {
        if (this.type == "weapon" && this.damage.value.includes("SB") || this.type == "trait" && this.rollable.bonusCharacteristic == "s") {
          game.wfrp4e.utility.logHomebrew("mooSizeDamage");
          let SBsToAdd = this.actor.sizeNum - 3;
          damage += this.actor.characteristics.s.bonus * SBsToAdd;
        }
      }
      return parseInt(damage || 0);
    }
    get DamageString() {
      let string = "";
      if (this.type == "weapon") {
        string += this.Damage;
      }
      if (this.damage.dice)
        string += `+ ${this.damage.dice}`;
      if (this.ammo && this.ammo.damage.dice)
        string += `+ ${this.ammo.damage.dice}`;
      return string;
    }
    get mountDamage() {
      if (this.attackType != "melee" || !this.actor.isMounted || !this.actor.mount)
        return this.Damage;
      if (this.type == "weapon")
        return this.applyAmmoMods(this.computeWeaponFormula("damage", this.actor.mount), "damage") + (this.actor.flags[`${this.attackType}DamageIncrease`] || 0) - Math.max(this.damageToItem.value - (this.properties.qualities.durable?.value || 0), 0);
      if (this.type == "trait" && this.rollable.bonusCharacteristic == "s") {
        return this.Damage + (this.actor.mount.characteristics[this.rollable.bonusCharacteristic].bonus - this.actor.characteristics[this.rollable.bonusCharacteristic].bonus);
      } else
        return this.Damage;
    }
    get Specification() {
      let specification;
      if (this.specification.value) {
        if (this.rollable.bonusCharacteristic) {
          specification = parseInt(this.specification.value) || 0;
          specification += this.actor.characteristics[this.rollable.bonusCharacteristic].bonus;
        } else
          specification = this.specification.value;
      }
      return specification;
    }
    get SpecificationBonus() {
      return this.actor.characteristics[this.rollable.bonusCharacteristic].bonus;
    }
    get advanced() {
      return this.system.advanced;
    }
    get advances() {
      return this.system.advances;
    }
    get ammunitionGroup() {
      return this.system.ammunitionGroup;
    }
    get ammunitionType() {
      return this.system.ammunitionType;
    }
    get armorType() {
      return this.system.armorType;
    }
    get availability() {
      return this.system.availability;
    }
    get career() {
      return this.system.career;
    }
    get careergroup() {
      return this.system.careergroup;
    }
    get cargoType() {
      return this.system.cargoType;
    }
    get carries() {
      return this.system.carries;
    }
    get characteristic() {
      if (!this.isOwned)
        return this.system.characteristic;
      let char;
      if (this.type == "skill") {
        char = this.actor.characteristics[this.system.characteristic.value];
        char.key = this.system.characteristic.value;
      }
      if (this.type == "trait" && this.rollable.value) {
        char = this.actor.characteristics[this.system.rollable.rollCharacteristic];
        char.key = this.system.rollable.rollCharacteristic;
      }
      return char;
    }
    get characteristics() {
      return this.system.characteristics;
    }
    get class() {
      return this.system.class;
    }
    get cn() {
      return this.system.cn;
    }
    get coinValue() {
      return this.system.coinValue;
    }
    get complete() {
      return this.system.complete;
    }
    get completion() {
      return this.system.completion;
    }
    get consumesAmmo() {
      return this.system.consumesAmmo;
    }
    get contraction() {
      return this.system.contraction;
    }
    get countEnc() {
      return this.system.countEnc;
    }
    get current() {
      return this.system.current;
    }
    get currentAmmo() {
      return this.system.currentAmmo;
    }
    get currentAP() {
      let currentAP = foundry.utils.deepClone(this.system.AP);
      for (let loc in currentAP) {
        currentAP[loc] -= this.properties.qualities.durable ? Math.max(0, this.APdamage[loc] - (this.properties.qualities.durable?.value || 0)) : this.APdamage[loc];
      }
      return currentAP;
    }
    get currentIng() {
      return this.system.currentIng;
    }
    get damage() {
      return this.system.damage;
    }
    get damageToItem() {
      return this.system.damageToItem;
    }
    get description() {
      return this.system.description;
    }
    get duration() {
      return this.system.duration;
    }
    get encumbrance() {
      return this.system.encumbrance;
    }
    get equipped() {
      return this.system.equipped;
    }
    get failingDecreases() {
      return this.system.failingDecreases;
    }
    get flaws() {
      return this.system.flaws;
    }
    get gmdescription() {
      return this.system.gmdescription;
    }
    get god() {
      return this.system.god;
    }
    get grouped() {
      return this.system.grouped;
    }
    get hide() {
      return this.system.hide;
    }
    get incomeSkill() {
      return this.system.incomeSkill;
    }
    get incubation() {
      return this.system.incubation;
    }
    get ingredients() {
      return this.system.ingredients;
    }
    get level() {
      return this.system.level;
    }
    get loaded() {
      return this.system.loaded;
    }
    get location() {
      return this.system.location;
    }
    get lore() {
      return this.system.lore;
    }
    get magicMissile() {
      return this.system.magicMissile;
    }
    get max() {
      return this.system.max;
    }
    get AP() {
      return this.system.AP;
    }
    get APdamage() {
      return this.system.APdamage;
    }
    get memorized() {
      return this.system.memorized;
    }
    get modeOverride() {
      return this.system.modeOverride;
    }
    get modifier() {
      return this.system.modifier;
    }
    get modifiesSkills() {
      return this.system.modifiesSkills;
    }
    get modType() {
      return this.system.modType;
    }
    get mutationType() {
      return this.system.mutationType;
    }
    get negativePossible() {
      return this.system.negativePossible;
    }
    get offhand() {
      return this.system.offhand;
    }
    get origin() {
      return this.system.origin;
    }
    get overcast() {
      return this.system.overcast;
    }
    get penalty() {
      return this.system.penalty;
    }
    get permanent() {
      return this.system.permanent;
    }
    get price() {
      return this.system.price;
    }
    get qualities() {
      return this.system.qualities;
    }
    get quality() {
      return this.system.quality;
    }
    get quantity() {
      return this.system.quantity;
    }
    get range() {
      return this.system.range;
    }
    get reach() {
      return this.system.reach;
    }
    get rollable() {
      return this.system.rollable;
    }
    get skill() {
      return this.system.skill;
    }
    get skills() {
      return this.system.skills;
    }
    get SL() {
      return this.system.SL;
    }
    get special() {
      return this.system.special;
    }
    get specification() {
      return this.system.specification;
    }
    get spellIngredient() {
      return this.system.spellIngredient;
    }
    get status() {
      return this.system.status;
    }
    get symptoms() {
      return this.system.symptoms;
    }
    get talents() {
      return this.system.talents;
    }
    get target() {
      return this.system.target;
    }
    get test() {
      return this.system.test;
    }
    get tests() {
      return this.system.tests;
    }
    get total() {
      return this.system.total;
    }
    get trappings() {
      return this.system.trappings;
    }
    get trappingType() {
      return this.system.trappingType;
    }
    get trappingCategory() {
      if (this.type == "trapping")
        return game.wfrp4e.config.trappingCategories[this.trappingType.value];
      else
        return game.wfrp4e.config.trappingCategories[this.type];
    }
    get twohanded() {
      return this.system.twohanded;
    }
    get prayerType() {
      return this.system.type;
    }
    get unitPrice() {
      return this.system.unitPrice;
    }
    get weaponGroup() {
      return this.system.weaponGroup || "basic";
    }
    get wearable() {
      return this.system.wearable;
    }
    get wind() {
      return this.system.wind;
    }
    get worn() {
      return this.system.worn;
    }
    get wounds() {
      return this.system.wounds;
    }
    toCompendium(pack) {
      let data = super.toCompendium(pack);
      data._id = this.id;
      return data;
    }
  };

  // modules/apps/travel-distance-wfrp4e.js
  var TravelDistanceWfrp4e = class {
    static async loadTravelData() {
      FilePicker.browse("data", `systems/wfrp4e/data/`).then((resp) => {
        for (var file of resp.files) {
          try {
            if (!file.includes(".json"))
              continue;
            let filename = file.substring(file.lastIndexOf("/") + 1, file.indexOf(".json"));
            fetch(file).then((r) => r.json()).then(async (records) => {
              this.travel_data = records;
            });
          } catch (error2) {
            console.error("Error reading " + file + ": " + error2);
          }
        }
      });
    }
    static dangerToString(dangerLevel) {
      if (dangerLevel == "")
        return game.i18n.localize("TRAVEL.DangerVeryLow");
      if (dangerLevel == "!")
        return game.i18n.localize("TRAVEL.DangerLow");
      if (dangerLevel == "!!")
        return game.i18n.localize("TRAVEL.DangerMedium");
      if (dangerLevel == "!!!")
        return game.i18n.localize("TRAVEL.DangerHigh");
      return game.i18n.localize("TRAVEL.DangerVeryHigh");
    }
    static roundDuration(duration) {
      let trunc = Math.trunc(duration);
      let frac = duration - trunc;
      let adjust = 0;
      if (frac > 0.75)
        adjust = 1;
      else if (frac >= 0.25)
        adjust = 0.5;
      return trunc + adjust;
    }
    static displayTravelDistance(fromTown, toTown) {
      let message2 = "";
      if (toTown) {
        fromTown = fromTown.toLowerCase();
        toTown = toTown.toLowerCase();
        for (var travel of this.travel_data) {
          if (travel.from.toLowerCase() == fromTown && travel.to.toLowerCase() == toTown) {
            message2 += `<p>${game.i18n.format("TRAVEL.TravelMessageBase", travel)}`;
            if (travel.road_distance != "") {
              travel.road_horse_heavy_days = this.roundDuration(travel.road_days * 0.8);
              travel.road_horse_fast_days = this.roundDuration(travel.road_days * 0.65);
              travel.road_feet_days = this.roundDuration(travel.road_days * 1.25);
              travel.road_danger_string = this.dangerToString(travel.road_danger);
              travel.road_danger_feet_string = this.dangerToString(travel.road_danger + "!");
              message2 += `${game.i18n.format("TRAVEL.TravelMessageRoad", travel)}`;
            }
            if (travel.river_distance != "") {
              travel.river_danger_string = this.dangerToString(travel.river_danger);
              message2 += `${game.i18n.format("TRAVEL.TravelMessageRiver", travel)}`;
            }
            if (travel.sea_distance != "") {
              travel.sea_danger_string = this.dangerToString(travel.sea_danger);
              message2 += `${game.i18n.format("TRAVEL.TravelMessageSea", travel)}`;
            }
            message2 += "</p>";
          }
        }
      } else if (fromTown && fromTown == "help") {
        message2 += `<p>${game.i18n.localize("TRAVEL.Helper")}</p>`;
      } else if (fromTown) {
        fromTown = fromTown.toLowerCase();
        message2 += `<h3>${game.i18n.localize("TRAVEL.TownPrompt")}</h3>`;
        for (var travel of this.travel_data) {
          if (travel.from.toLowerCase() == fromTown) {
            message2 += `<div><a class = "travel-click" data-fromtown="${travel.from}" data-totown = "${travel.to}"><i class="fas fa-list"></i> ${travel.to}</a></div>`;
          }
        }
      } else {
        message2 += `<h3>${game.i18n.localize("TRAVEL.TownOriginPrompt")}</h3>`;
        let uniqTown = {};
        for (var travel of this.travel_data) {
          if (uniqTown[travel.from] == void 0) {
            uniqTown[travel.from] = 1;
            message2 += `<div><a class = "travel-click" data-fromtown="${travel.from}"><i class="fas fa-list"></i> ${travel.from}</a></div>`;
          }
        }
      }
      ChatMessage.create(WFRP_Utility.chatDataSetup(message2));
    }
    static handleTravelClick(event2) {
      let fromTown = $(event2.currentTarget).attr("data-fromtown");
      let toTown = $(event2.currentTarget).attr("data-totown");
      TravelDistanceWfrp4e.displayTravelDistance(fromTown, toTown);
    }
  };

  // modules/system/audio-wfrp4e.js
  var WFRP_Audio = class {
    static PlayContextAudio(context) {
      this.MatchContextAudio(context).then((sound) => {
        if (!sound || !sound.file) {
          console.warn("wfrp4e | Sound file not found for context: %o", context);
          return;
        }
        game.wfrp4e.utility.log(`wfrp4e | Playing Sound: ${sound.file}`);
        AudioHelper.play({ src: sound.file }, sound.global);
      });
    }
    static FindContext(test) {
      let context = void 0;
      if (test.skill) {
        if (test.skill.name == game.i18n.localize("NAME.ConsumeAlcohol")) {
          context = { item: test.skill, action: "consumeAlcohol" };
          context.outcome = test.result.roll <= 5 || test.result.roll <= test.result.target ? "success" : "fail";
        }
        if (test.skill.name == game.i18n.localize("NAME.PickLock")) {
          context = { item: test.skill, action: "pickLock" };
        } else if (test.skill.name == game.i18n.localize("NAME.Stealth")) {
          context = { item: test.skill, action: "stealth" };
          context.outcome = test.result.roll <= 5 || test.result.roll <= test.result.target ? "success" : "fail";
        }
      }
      if (test.weapon) {
        context = { item: test.weapon, action: "fire" };
        if (test.result.misfire)
          context.action = "misfire";
        if (test.weapon.attackType == "ranged" && test.result.outcome == "failure" && (test.weapon.weaponGroup.value === "bow" || test.weapon.weaponGroup.value === "crossbow" || test.weapon.weaponGroup.value === "blackpowder" || test.weapon.weaponGroup.value === "engineering")) {
          let delayedContext = foundry.utils.deepClone(context);
          delayedContext.action = "miss";
          setTimeout((delayedContext2) => {
            this.PlayContextAudio(delayedContext2);
          }, 1e3, delayedContext);
        }
        if (test.weapon.weaponGroup == "explosives" || test.weapon.weaponGroup == "throwing")
          context.action = "throw";
      }
      if (test.result.critical && test.weapon && test.weapon.properties.qualities.impale) {
        context = { item: {}, action: "hit", outcome: "crit_impale" };
      }
      if (test.spell) {
        if (test.result.castOutcome == "success") {
          context = { item: test.spell, action: "cast" };
          if (test.spell.damage)
            context.outcome = "damage";
        }
        if (test.result.minormis || test.result.majormis)
          context = { item: test.spell, action: "miscast" };
      }
      if (test.prayer) {
        if (test.result.outcome == "success")
          context = { item: test.prayer, action: "cast" };
        if (test.result.wrath)
          context = { item: test.prayer, action: "miscast" };
      }
      return context;
    }
    static async MatchContextAudio(context) {
      if (!game.settings.get("wfrp4e", "soundPath") || !context)
        return {};
      try {
        let files, file, group;
        await FilePicker.browse("user", game.settings.get("wfrp4e", "soundPath")).then((resp) => {
          files = resp.files;
        });
        if (context.action == "hit")
          file = "hit";
        let globalSound = false;
        {
          switch (context.item.type) {
            case "weapon":
              group = context.item.weaponGroup.value;
              if (group == "crossbow")
                file = context.action == "equip" ? "weapon_bow" : "weapon_xbow";
              else if (group == "bow")
                file = "weapon_bow";
              else if (group == "fencing" || group == "parry" || group == "twohanded")
                file = context.action == "fire" ? "weapon-" : "weapon_sword";
              else if (group == "flail" && context.action == "fire") {
                file = "weapon_flail-";
                if (context.item.properties.qualities.impact)
                  file = "weapon_flail_impact";
              } else if (group == "blackpowder" || group == "engineering")
                file = "weapon_gun";
              else if (group == "explosives")
                file = "weapon_bomb";
              else if (group == "throwintg") {
                file = "weapon-";
                if (context.action != "equip") {
                  file = "weapon_throw";
                  if (context.item.properties.qualities.hack)
                    file = "weapon_axe_throw";
                }
              } else if (group == "entangling" && context.action != "swing")
                file = "weapon_entangling";
              else
                file = "weapon-";
              break;
            case "armour":
              if (context.action.includes("equip")) {
                group = context.item.armorType.value;
                file = group.includes("Leather") ? "leather" : group;
              } else if (context.action == "hit") {
                group = context.item.type;
                file = context.outcome || "";
              }
              break;
            case "trapping":
              file = context.item.trappingType.value.includes("clothing") ? "cloth" : "item";
              break;
            case "spell":
              file = "spell";
              break;
            case "prayer":
              file = "prayer";
              break;
            case "round":
              file = "round";
              globalSound = true;
              break;
            case "skill":
              file = "skill";
              break;
            case "money":
              file = "money";
              break;
            case "shield":
              file = "weapon_shield";
              break;
            case "throw":
              file = "hit_throw-";
              break;
            case "throw_axe":
              file = "hit_throw_axe";
              break;
          }
        }
        if (context.item.special == "warhammer")
          file = "warhammer";
        files = files.filter((f) => f.includes(file));
        if (context.item.type == "weapon") {
          globalSound = true;
          if (context.action == "miss")
            files = files.filter((f) => f.includes("-miss"));
          else if (context.action == "misfire")
            files = files.filter((f) => f.includes("-misfire"));
          else if (context.action == "fire") {
            if (file == "weapon_xbow" || file == "weapon_bow" || file == "weapon_gun" || file.includes("throw"))
              files = files.filter((f) => f.includes("-fire"));
            else if (file != "weapon_bomb")
              files = files.filter((f) => f.includes("-swing"));
            else
              files = files.filter((f) => f.includes("-throw"));
          } else if (context.action == "load")
            files = files.filter((f) => f.includes("-load"));
          else if (context.action == "damage") {
            globalSound = false;
            files = files.filter((f) => f.includes("damage"));
            if (context.outcome == "shield")
              files = files.filter((f) => f.includes("shield"));
          }
        }
        if (context.item.type == "shield") {
          files = files.filter((f) => f.includes(context.action));
        }
        if (context.action == "equip") {
          if (context.outcome || context.item.type == "weapon") {
            files = files.filter((f) => f.includes("-equip"));
          } else {
            files = files.filter((f) => f.includes("deequip"));
          }
        }
        if (context.action == "hit") {
          files = files.filter((f) => f.includes("hit"));
        }
        if (context.item.type == "spell") {
          if (context.action == "memorize")
            files = files.filter((f) => f.includes("-memorize"));
          else if (context.action == "unmemorize")
            files = files.filter((f) => f.includes("unmemorize"));
          else if (context.action == "cast") {
            if (context.outcome == "damage")
              files = files.filter((f) => f.includes("damage-cast"));
            else
              files = files.filter((f) => f.includes("-cast") && !f.includes("damage"));
            globalSound = true;
          } else {
            files = files.filter((f) => f.includes("miscast"));
            globalSound = true;
          }
        }
        if (context.item.type == "prayer") {
          globalSound = true;
          if (context.action == "cast")
            files = files.filter((f) => f.includes("-cast"));
          else
            files = files.filter((f) => f.includes("miscast"));
        }
        if (context.action == "hit") {
          globalSound = true;
          if (context.outcome == "blocked")
            files = files.filter((f) => f.includes(context.item.armourType));
          else if (context.item.type == "armour")
            files = files.filter((f) => f.includes("armour"));
          else
            files = files.filter((f) => !f.includes("armour"));
          if (context.outcome == "normal")
            files = files.filter((f) => f.includes("normal"));
          if (context.outcome == "warhammer")
            files = files.filter((f) => f.includes("warhammer"));
          if (context.outcome == "crit")
            files = files.filter((f) => f.includes("crit-"));
          if (context.outcome == "crit_impale")
            files = files.filter((f) => f.includes("crit_impale"));
        }
        if (context.item.type == "skill") {
          if (context.action == "consumeAlcohol")
            files = files.filter((f) => f.includes(`consumeAlcohol-${context.outcome == "fail" ? "fail" : "success"}`));
          if (context.action == "stealth")
            files = files.filter((f) => f.includes(`stealth-${context.outcome == "fail" ? "fail" : "success"}`));
          if (context.action == "pickLock")
            files = files.filter((f) => f.includes(context.action));
        }
        return { file: files[(await new Roll(`1d${files.length}-1`).roll({ async: true })).total], global: globalSound };
      } catch (e) {
        WFRP_Utility.log("Sound Context Error: " + e, true);
      }
    }
  };

  // modules/system/opposed-test.js
  var OpposedTest = class {
    constructor(attackerTest = void 0, defenderTest = void 0, opposeResult = {}) {
      this.data = {
        attackerTestData: attackerTest?.data,
        defenderTestData: defenderTest?.data,
        opposeResult
      };
      this.attackerTest = attackerTest;
      this.defenderTest = defenderTest;
    }
    get opposeResult() {
      return this.data.opposeResult;
    }
    get result() {
      return this.data.opposeResult;
    }
    get attacker() {
      return this.attackerTest.actor;
    }
    get defender() {
      return this.defenderTest.actor;
    }
    static recreate(data) {
      let opposedTest = new OpposedTest();
      opposedTest.data = data;
      opposedTest.createAttackerTest(data.attackerTestData);
      opposedTest.createDefenderTest(data.defenderTestData);
      return opposedTest;
    }
    _createTest(testData) {
      if (!testData)
        return testData;
      let test = game.wfrp4e.rolls.TestWFRP.recreate(testData);
      test.data = testData;
      return test;
    }
    createAttackerTest(testData) {
      this.attackerTest = this._createTest(testData);
      this.data.attackerTestData = testData;
    }
    createDefenderTest(testData) {
      this.defenderTest = this._createTest(testData);
      this.data.defenderTestData = testData;
    }
    createUnopposedDefender(actor) {
      this.defenderTest = new game.wfrp4e.rolls.CharacteristicTest({
        item: "ws",
        SL: 0,
        target: 0,
        roll: 0,
        unopposedTarget: true
      }, actor);
      this.defenderTest.data.context.unopposed = true;
      this.data.defenderTestData = this.defenderTest.data;
    }
    checkPostModifiers() {
      let didModifyAttacker = false, didModifyDefender = false;
      let modifiers = {
        attacker: {
          target: 0,
          SL: 0
        },
        defender: {
          target: 0,
          SL: 0
        },
        message: []
      };
      if (game.settings.get("wfrp4e", "weaponLength") && this.attackerTest.weapon && this.defenderTest.weapon && this.attackerTest.weapon.attackType == "melee" && this.defenderTest.weapon.attackType == "melee") {
        let attackerReach = this.attackerTest.item.reachNum;
        let defenderReach = this.defenderTest.item.reachNum;
        if (defenderReach > attackerReach && !this.attackerTest.result.infighter) {
          didModifyAttacker = true;
          modifiers.message.push(game.i18n.format(game.i18n.localize("CHAT.TestModifiers.WeaponLength"), { defender: this.defenderTest.actor.prototypeToken.name, attacker: this.attackerTest.actor.prototypeToken.name }));
          modifiers.attacker.target += -10;
        }
      }
      if (didModifyAttacker || didModifyDefender) {
        modifiers.message.push(game.i18n.localize("CHAT.TestModifiers.FinalModifiersTitle"));
        if (didModifyAttacker)
          modifiers.message.push(`${game.i18n.format(game.i18n.localize("CHAT.TestModifiers.FinalModifiers"), { target: modifiers.attacker.target, sl: modifiers.attacker.SL, name: this.attackerTest.actor.prototypeToken.name })}`);
        if (didModifyDefender)
          modifiers.message.push(`${game.i18n.format(game.i18n.localize("CHAT.TestModifiers.FinalModifiers"), { target: modifiers.defender.target, sl: modifiers.defender.SL, name: this.defenderTest.actor.prototypeToken.name })}`);
      }
      return mergeObject(modifiers, { didModifyAttacker, didModifyDefender });
    }
    async evaluate() {
      try {
        let opposeResult = this.result;
        let attackerTest = this.attackerTest;
        let defenderTest = this.defenderTest;
        let soundContext = {};
        opposeResult.other = [];
        let attacker = this.attackerTest.actor;
        let defender = this.defenderTest.actor;
        attacker.runEffects("preOpposedAttacker", { attackerTest, defenderTest, opposedTest: this });
        defender.runEffects("preOpposedDefender", { attackerTest, defenderTest, opposedTest: this });
        opposeResult.modifiers = this.checkPostModifiers(attackerTest, defenderTest);
        if (opposeResult.modifiers.didModifyAttacker) {
          attackerTest.preData.roll = attackerTest.result.roll;
          attackerTest.preData.postOpposedModifiers = opposeResult.modifiers.attacker;
          attackerTest.preData.hitloc = attackerTest.result.hitloc?.roll;
          await attackerTest.computeResult();
          await attackerTest.renderRollCard();
        }
        if (opposeResult.modifiers.didModifyDefender) {
          defenderTest.preData.roll = defenderTest.result.roll;
          defenderTest.preData.postOpposedModifiers = opposeResult.modifiers.defender;
          defenderTest.preData.hitloc = defenderTest.result.hitloc?.roll;
          await defenderTest.computeResult();
          await defenderTest.renderRollCard();
        } else if (defenderTest.context.unopposed)
          defenderTest.roll();
        opposeResult.other = opposeResult.other.concat(opposeResult.modifiers.message);
        let attackerSL = parseInt(attackerTest.result.SL);
        let defenderSL = parseInt(defenderTest.result.SL);
        opposeResult.differenceSL = 0;
        if (attackerSL > defenderSL || attackerSL === defenderSL && (attackerTest.target > defenderTest.target || attackerTest.outcome == "success" && defenderTest.context.unopposed)) {
          opposeResult.winner = "attacker";
          opposeResult.differenceSL = attackerSL - defenderSL;
          if (Number.isNumeric(attackerTest.damage)) {
            let damage = this.calculateOpposedDamage();
            opposeResult.damage = {
              description: `<b>${game.i18n.localize("Damage")}</b>: ${damage}`,
              value: damage
            };
          } else if (attackerTest.weapon || attackerTest.trait) {
            opposeResult.damage = {
              description: `<b>${game.i18n.localize("Damage")}</b>: ?`,
              value: null
            };
          }
          if (attackerTest.hitloc) {
            let remappedHitLoc = await game.wfrp4e.tables.rollTable(defender.details.hitLocationTable.value, { lookup: attackerTest.hitloc.roll, hideDSN: true });
            if (remappedHitLoc.result != attackerTest.hitloc.result) {
              remappedHitLoc.description = game.i18n.localize(remappedHitLoc.description) + " (Remapped)";
              remappedHitLoc.remapped = true;
              attackerTest.result.hitloc = remappedHitLoc;
            }
            opposeResult.hitloc = {
              description: `<b>${game.i18n.localize("ROLL.HitLocation")}</b>: ${attackerTest.hitloc.description}`,
              value: attackerTest.hitloc.result
            };
          }
          try {
            if (attackerTest.weapon.weaponGroup.value === "bow" || attackerTest.weapon.weaponGroup.value === "crossbow") {
              soundContext = { item: attackerTest.weapon, action: "hit" };
            }
            if (attackerTest.weapon.weaponGroup.value == "throwing") {
              soundContext.item = { type: "throw" };
              if (attackerTest.weapon.properties.qualities.hack) {
                soundContext.item = { type: "throw_axe" };
              }
            }
          } catch (e) {
            WFRP_Utility.log("Sound Context Error: " + e, true);
          }
        } else {
          try {
            if (attackerTest.weapon && (attackerTest.weapon.weaponGroup.value === "bow" || attackerTest.weapon.weaponGroup.value === "crossbow" || attackerTest.weapon.weaponGroup.value === "blackpowder" || attackerTest.weapon.weaponGroup.value === "engineering")) {
              soundContext = { item: attackerTest.weapon, action: "miss" };
            }
            if (defenderTest.weapon && defenderTest.weapon.properties.qualities.shield) {
              if (attackerTest.weapon.attackType == "melee") {
                soundContext = { item: { type: "shield" }, action: "miss_melee" };
              } else {
                if (attackerTest.weapon.weaponGroup.value === "bow" || attackerTest.weapon.weaponGroup.value === "sling" || attackerTest.weapon.weaponGroup.value === "throwing" || attackerTest.weapon.weaponGroup.value === "crossbow") {
                  soundContext = { item: { type: "shield" }, action: "miss_ranged" };
                }
              }
            }
          } catch (e) {
            WFRP_Utility.log("Sound Context Error: " + e, true);
          }
          opposeResult.winner = "defender";
          opposeResult.differenceSL = defenderSL - attackerSL;
          let riposte;
          if (defenderTest.weapon)
            riposte = defenderTest.result.riposte && !!defenderTest.weapon.properties.qualities.fast;
          if (defenderTest.result.champion || riposte) {
            let temp = duplicate(defenderTest.data);
            this.defenderTest = game.wfrp4e.rolls.TestWFRP.recreate(attackerTest.data);
            this.attackerTest = game.wfrp4e.rolls.TestWFRP.recreate(temp);
            this.data.attackerTestData = this.attackerTest.data;
            this.data.defenderTestData = this.defenderTest.data;
            let damage = this.calculateOpposedDamage();
            opposeResult.damage = {
              description: `<b>${game.i18n.localize("Damage")} (${riposte ? game.i18n.localize("NAME.Riposte") : game.i18n.localize("NAME.Champion")})</b>: ${damage}`,
              value: damage
            };
            let hitloc = await game.wfrp4e.tables.rollTable(defenderTest.actor.details.hitLocationTable.value, { hideDSN: true });
            opposeResult.hitloc = {
              description: `<b>${game.i18n.localize("ROLL.HitLocation")}</b>: ${hitloc.description}`,
              value: hitloc.result
            };
            opposeResult.swapped = true;
            soundContext = { item: { type: "weapon" }, action: "hit" };
          }
        }
        attacker.runEffects("opposedAttacker", { opposedTest: this, attackerTest, defenderTest });
        if (defender)
          defender.runEffects("opposedDefender", { opposedTest: this, attackerTest, defenderTest });
        Hooks.call("wfrp4e:opposedTestResult", this, attackerTest, defenderTest);
        WFRP_Audio.PlayContextAudio(soundContext);
        return opposeResult;
      } catch (err) {
        ui.notifications.error(`${game.i18n.localize("ErrorOpposed")}: ` + err);
        console.error("Could not complete opposed test: " + err);
      }
    }
    calculateOpposedDamage() {
      let damageMultiplier = 1;
      let sizeDiff;
      sizeDiff = game.wfrp4e.config.actorSizeNums[this.attackerTest.size] - game.wfrp4e.config.actorSizeNums[this.defenderTest.size];
      if (this.attackerTest.actor.getItemTypes("trait").find((i) => i.name == game.i18n.localize("NAME.Swarm") && i.included) || this.defenderTest.actor.getItemTypes("trait").find((i) => i.name == game.i18n.localize("NAME.Swarm")))
        sizeDiff = 0;
      damageMultiplier = sizeDiff >= 2 ? sizeDiff : 1;
      let opposedSL = Number(this.attackerTest.result.SL) - Number(this.defenderTest.result.SL);
      let item = this.attackerTest.item;
      let damage;
      if (this.attackerTest.useMount)
        damage = item.mountDamage;
      else
        damage = item.Damage;
      if (game.settings.get("wfrp4e", "mooSLDamage")) {
        game.wfrp4e.utility.logHomebrew("mooSLDamage");
        opposedSL = Number(this.attackerTest.result.SL);
      }
      damage += opposedSL + (this.attackerTest.result.additionalDamage || 0);
      if (game.settings.get("wfrp4e", "mooRangedDamage")) {
        game.wfrp4e.utility.logHomebrew("mooRangedDamage");
        if (this.attackerTest.item && this.attackerTest.item.attackType == "ranged") {
          damage -= Math.floor(this.attackerTest.targetModifiers / 10) || 0;
          if (damage < 0)
            damage = 0;
        }
      }
      let effectArgs = { damage, damageMultiplier, sizeDiff, opposedTest: this, addDamaging: false, addImpact: false };
      this.attackerTest.actor.runEffects("calculateOpposedDamage", effectArgs);
      ({ damage, damageMultiplier, sizeDiff } = effectArgs);
      if (game.settings.get("wfrp4e", "mooSizeDamage"))
        sizeDiff = 0;
      let addDamaging = effectArgs.addDamaging || false;
      let addImpact = effectArgs.addImpact || false;
      if (this.attackerTest.trait) {
        if (sizeDiff >= 1)
          addDamaging = true;
        if (sizeDiff >= 2)
          addImpact = true;
      }
      let hasDamaging = false;
      let hasImpact = false;
      if (this.attackerTest.weapon) {
        hasDamaging = this.attackerTest.weapon.properties.qualities.damaging;
        hasImpact = this.attackerTest.weapon.properties.qualities.impact;
        if (this.attackerTest.result.charging || !this.attackerTest.weapon.properties.flaws.tiring) {
          if (hasDamaging)
            addDamaging = true;
          if (hasImpact)
            addImpact = true;
        }
        if (sizeDiff >= 1)
          addDamaging = true;
        if (sizeDiff >= 2)
          addImpact = true;
      }
      if (addDamaging) {
        let unitValue = Number(this.attackerTest.result.roll.toString().split("").pop());
        if (unitValue === 0)
          unitValue = 10;
        if (unitValue > opposedSL) {
          damage = damage - opposedSL + unitValue;
        }
      }
      if (addImpact) {
        let unitValue = Number(this.attackerTest.result.roll.toString().split("").pop());
        if (unitValue === 0)
          unitValue = 10;
        damage += unitValue;
      }
      this.result.damaging = hasDamaging || addDamaging;
      this.result.impact = hasImpact || addImpact;
      return damage * damageMultiplier;
    }
  };

  // modules/system/opposed-wfrp4e.js
  var OpposedWFRP = class {
    constructor(data = {}) {
      this.data = {
        messageId: data.messageId,
        attackerMessageId: data.attackerMessageId,
        defenderMessageId: data.defenderMessageId,
        resultMessageId: data.resultMessageId,
        targetSpeakerData: data.targetSpeakerData,
        options: data.options || {},
        unopposed: data.unopposed
      };
    }
    get message() {
      return game.messages.get(this.data.messageId);
    }
    get resultMessage() {
      return game.messages.get(this.data.resultMessageId);
    }
    get target() {
      return WFRP_Utility.getToken(this.data.targetSpeakerData);
    }
    get attackerMessage() {
      return game.messages.get(this.data.attackerMessageId);
    }
    get defenderMessage() {
      return game.messages.get(this.data.defenderMessageId);
    }
    get attackerTest() {
      return this.attackerMessage?.getTest();
    }
    get defenderTest() {
      if (this.unopposed) {
        return new game.wfrp4e.rolls.CharacteristicTest({
          item: "ws",
          SL: 0,
          target: 0,
          roll: 0,
          unopposed: true
        }, this.target.actor);
      } else
        return this.defenderMessage?.getTest();
    }
    get attacker() {
      return this.attackerTest?.actor;
    }
    get defender() {
      return this.defenderTest ? this.defenderTest.actor : WFRP_Utility.getSpeaker(this.data.targetSpeakerData);
    }
    get options() {
      return this.data.options;
    }
    get unopposed() {
      return this.data.unopposed;
    }
    async startOppose(targetToken) {
      this.data.targetSpeakerData = targetToken.actor.speakerData(targetToken);
      await this.renderOpposedStart();
      this._addOpposeFlagsToDefender(targetToken);
      return this.message.id;
    }
    setAttacker(message2) {
      this.data.attackerMessageId = typeof message2 == "string" ? message2 : message2.id;
      this.data.options = {
        whisper: message2.whisper,
        blind: message2.blind
      };
      if (this.message)
        return this.updateMessageFlags();
    }
    setDefender(message2) {
      this.data.defenderMessageId = typeof message2 == "string" ? message2 : message2.id;
      if (this.message)
        return this.updateMessageFlags();
    }
    async computeOpposeResult() {
      if (!this.attackerTest || !this.defenderTest)
        throw new Error(game.i18n.localize("ERROR.Opposed"));
      this.opposedTest = new OpposedTest(this.attackerTest, this.defenderTest);
      await this.opposedTest.evaluate();
      this.formatOpposedResult();
      this.renderOpposedResult();
      this.colorWinnerAndLoser();
    }
    renderOpposedStart() {
      return new Promise(async (resolve) => {
        let attacker = WFRP_Utility.getToken(this.attackerTest.context.speaker) || this.attacker.prototypeToken;
        let defender;
        if (this.target)
          defender = this.target;
        else if (this.defenderTest)
          defender = WFRP_Utility.getToken(this.defenderTest.context.speaker) || this.defender.prototypeToken;
        let defenderImg = defender ? `<a class = "defender"><img src="${defender.texture.src}" width="50" height="50"/></a>` : `<a class = "defender"><img width="50" height="50"/></a>`;
        let content = `<div class ="opposed-message">
            ${game.i18n.format("ROLL.Targeting", { attacker: attacker.name, defender: defender ? defender.name : "???" })}
          </div>
          <div class = "opposed-tokens">
          <a class = "attacker"><img src="${attacker.texture.src}" width="50" height="50"/></a>
          ${defenderImg}
          </div>
          <div class="unopposed-button" data-target="true" title="${game.i18n.localize("Unopposed")}"><a><i class="fas fa-arrow-down"></i></a></div>`;
        if (this.attackerTest.item && this.attackerTest.item.attackType == "ranged" && this.attackerTest.result.outcome == "failure") {
          ChatMessage.create({ speaker: this.attackerMessage.speaker, content: game.i18n.localize("OPPOSED.FailedRanged") });
          return;
        }
        let chatData = {
          user: game.user.id,
          content,
          speaker: { alias: game.i18n.localize("CHAT.OpposedTest") },
          whisper: this.options.whisper,
          blind: this.options.blind,
          "flags.wfrp4e.opposeData": this.data
        };
        if (this.message) {
          await this.message.update(chatData);
          resolve(this.data.messageId);
        } else {
          return ChatMessage.create(chatData).then(async (msg) => {
            this.data.messageId = msg.id;
            await this.updateMessageFlags();
            resolve(msg.id);
          });
        }
      });
    }
    updateMessageFlags() {
      let updateData = { "flags.wfrp4e.opposeData": this.data };
      if (this.message && game.user.isGM)
        return this.message.update(updateData);
      else if (this.message) {
        this.message.flags.wfrp4e.opposeData = this.data;
        game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: this.message.id, updateData } });
      }
    }
    async renderOpposedResult() {
      let opposeData = this.opposedTest.data;
      let opposeResult = this.opposedTest.result;
      let options = this.options;
      opposeResult.hideData = true;
      let html = await renderTemplate("systems/wfrp4e/templates/chat/roll/opposed-result.html", opposeResult);
      let chatOptions = {
        user: game.user.id,
        content: html,
        "flags.wfrp4e.opposeTestData": opposeData,
        "flags.wfrp4e.opposeId": this.message.id,
        whisper: options.whisper,
        blind: options.blind
      };
      return ChatMessage.create(chatOptions).then((msg) => {
        this.data.resultMessageId = msg.id;
        this.updateMessageFlags();
      });
    }
    formatOpposedResult() {
      let opposeResult = this.opposedTest.opposeResult;
      let attackerAlias = this.attackerTest.message.speaker.alias;
      let defenderAlias = this.defenderMessage ? this.defenderMessage.speaker.alias : this.defenderTest.actor.prototypeToken.name;
      if (opposeResult.winner == "attacker") {
        opposeResult.result = game.i18n.format("OPPOSED.AttackerWins", {
          attacker: attackerAlias,
          defender: defenderAlias,
          SL: opposeResult.differenceSL
        });
        opposeResult.img = this.attackerMessage.flags.img;
      } else if (opposeResult.winner == "defender") {
        opposeResult.result = game.i18n.format("OPPOSED.DefenderWins", {
          defender: defenderAlias,
          attacker: attackerAlias,
          SL: opposeResult.differenceSL
        });
        opposeResult.img = this.defenderMessage ? this.defenderMessage.flags.img : this.defenderTest.actor.prototypeToken.texture.src;
      }
      return opposeResult;
    }
    colorWinnerAndLoser() {
      try {
        let winner = this.opposedTest.opposeResult.winner;
        let loser = winner == "attacker" ? "defender" : "attacker";
        let content = this.message.content;
        content = content.replace(winner, `${winner} winner`);
        content = content.replace(loser, `${loser} loser`);
        if (!game.user.isGM)
          return game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: this.message.id, updateData: { content } } });
        else
          return this.message.update({ content });
      } catch (e) {
        console.error(`Error color coding winner and loser: ${e}`);
      }
    }
    _addOpposeFlagsToDefender(target) {
      if (!game.user.isGM) {
        game.socket.emit("system.wfrp4e", {
          type: "target",
          payload: {
            target: target.id,
            scene: canvas.scene.id,
            opposeFlag: { opposeMessageId: this.data.messageId }
          }
        });
      } else {
        target.actor.update(
          {
            "flags.oppose": { opposeMessageId: this.data.messageId }
          }
        );
      }
    }
    static async opposedClicked(event2) {
      let button = $(event2.currentTarget), messageId = button.parents(".message").attr("data-message-id"), message2 = game.messages.get(messageId);
      if (game.wfrp4e.oppose) {
        game.wfrp4e.oppose.setDefender(message2);
        await game.wfrp4e.oppose.renderOpposedStart();
        game.wfrp4e.oppose.computeOpposeResult();
        delete game.wfrp4e.oppose;
      } else {
        game.wfrp4e.oppose = new OpposedWFRP();
        game.wfrp4e.oppose.setAttacker(message2);
        game.wfrp4e.oppose.renderOpposedStart();
      }
    }
    resolveUnopposed() {
      this.data.unopposed = true;
      this.computeOpposeResult();
      this.defender.clearOpposed();
    }
    _updateOpposedMessage(damageConfirmation) {
      return OpposedWFRP.updateOpposedMessage(damageConfirmation, this.data.resultMessageId);
    }
    static updateOpposedMessage(damageConfirmation, messageId) {
      let resultMessage = game.messages.get(messageId);
      let rollMode = resultMessage.rollMode;
      let newCard = {
        user: game.user.id,
        rollMode,
        hideData: true,
        content: $(resultMessage.content).append(`<div>${damageConfirmation}</div>`).html()
      };
      if (!game.user.isGM)
        return game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: msgId, updateData: newCard } });
      else
        return resultMessage.update(newCard);
    }
  };

  // modules/system/aoe.js
  var AbilityTemplate = class extends MeasuredTemplate {
    #moveTime = 0;
    #initialLayer;
    #events;
    static fromString(aoeString) {
      if (aoeString.toLowerCase().includes(game.i18n.localize("AoE").toLowerCase()))
        aoeString = aoeString.substring(aoeString.indexOf("(") + 1, aoeString.length - 1);
      const templateData = {
        t: "circle",
        user: game.user.id,
        distance: parseInt(aoeString),
        direction: 0,
        x: 0,
        y: 0,
        fillColor: game.user.color
      };
      const cls = CONFIG.MeasuredTemplate.documentClass;
      const template = new cls(templateData, { parent: canvas.scene });
      return new this(template);
    }
    drawPreview() {
      const initialLayer = canvas.activeLayer;
      this.draw();
      this.layer.activate();
      this.layer.preview.addChild(this);
      this.actorSheet?.minimize();
      return this.activatePreviewListeners(initialLayer);
    }
    activatePreviewListeners(initialLayer) {
      return new Promise((resolve, reject2) => {
        this.#initialLayer = initialLayer;
        this.#events = {
          cancel: this._onCancelPlacement.bind(this),
          confirm: this._onConfirmPlacement.bind(this),
          move: this._onMovePlacement.bind(this),
          resolve,
          reject: reject2,
          rotate: this._onRotatePlacement.bind(this)
        };
        canvas.stage.on("mousemove", this.#events.move);
        canvas.stage.on("mousedown", this.#events.confirm);
        canvas.app.view.oncontextmenu = this.#events.cancel;
        canvas.app.view.onwheel = this.#events.rotate;
      });
    }
    async _finishPlacement(event2) {
      this.layer._onDragLeftCancel(event2);
      canvas.stage.off("mousemove", this.#events.move);
      canvas.stage.off("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = null;
      canvas.app.view.onwheel = null;
      this.#initialLayer.activate();
      await this.actorSheet?.maximize();
    }
    _onMovePlacement(event2) {
      event2.stopPropagation();
      let now = Date.now();
      if (now - this.#moveTime <= 20)
        return;
      const center = event2.data.getLocalPosition(this.layer);
      const snapped = canvas.grid.getSnappedPosition(center.x, center.y, 2);
      this.document.updateSource({ x: snapped.x, y: snapped.y });
      this.refresh();
      this.#moveTime = now;
      this.updateAOETargets(this.document);
    }
    _onRotatePlacement(event2) {
      if (event2.ctrlKey)
        event2.preventDefault();
      event2.stopPropagation();
      let delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
      let snap = event2.shiftKey ? delta : 5;
      const update = { direction: this.document.direction + snap * Math.sign(event2.deltaY) };
      this.document.updateSource(update);
      this.refresh();
    }
    async _onConfirmPlacement(event2) {
      await this._finishPlacement(event2);
      const destination = canvas.grid.getSnappedPosition(this.document.x, this.document.y, 2);
      this.document.updateSource(destination);
      this.#events.resolve(canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()]));
    }
    async _onCancelPlacement(event2) {
      await this._finishPlacement(event2);
      this.#events.reject();
    }
    updateAOETargets(templateData) {
      let grid = canvas.scene.grid;
      let templateGridSize = templateData.distance / grid.distance * grid.size;
      let minx = templateData.x - templateGridSize;
      let miny = templateData.y - templateGridSize;
      let maxx = templateData.x + templateGridSize;
      let maxy = templateData.y + templateGridSize;
      let newTokenTargets = [];
      canvas.tokens.placeables.forEach((t) => {
        if (t.x + t.width / 2 < maxx && t.x + t.width / 2 > minx && t.y + t.height / 2 < maxy && t.y + t.height / 2 > miny)
          newTokenTargets.push(t.id);
      });
      game.user.updateTokenTargets(newTokenTargets);
    }
  };

  // modules/system/chat-wfrp4e.js
  var ChatWFRP = class {
    static addEffectButtons(content, conditions = []) {
      let regex = /@Condition\[(.+?)\]/gm;
      let matches = Array.from(content.matchAll(regex));
      conditions = conditions.concat(matches.map((m) => m[1].toLowerCase())).filter((i) => game.wfrp4e.config.conditions[i]);
      conditions = conditions.filter((c, i) => conditions.indexOf(c) == i);
      if (conditions.length) {
        let html = `<div class="apply-conditions">`;
        conditions.forEach(
          (c) => html += `<a class="chat-button apply-condition" data-cond="${c}">${game.i18n.localize("CHAT.Apply")} ${game.wfrp4e.config.conditions[c]}</a>`
        );
        html += `</div>`;
        content += html;
      }
      return content;
    }
    static async chatListeners(html) {
      html.on("click", ".talent-lookup", async (ev) => {
        WFRP_Utility.findTalent(ev.target.text).then((talent) => talent.sheet.render(true));
      });
      html.on("click", ".skill-lookup", async (ev) => {
        WFRP_Utility.findSkill(ev.target.text).then((skill) => skill.sheet.render(true));
      });
      html.on("mousedown", ".talent-drag", async (ev) => {
        if (ev.button == 2)
          WFRP_Utility.findTalent(ev.target.text).then((talent) => talent.sheet.render(true));
      });
      html.on("mousedown", ".skill-drag", async (ev) => {
        if (ev.button == 2)
          WFRP_Utility.findSkill(ev.target.text).then((skill) => skill.sheet.render(true));
      });
      html.on("click", ".chat-roll", WFRP_Utility.handleRollClick.bind(WFRP_Utility));
      html.on("click", ".symptom-tag", WFRP_Utility.handleSymptomClick.bind(WFRP_Utility));
      html.on("click", ".condition-chat", WFRP_Utility.handleConditionClick.bind(WFRP_Utility));
      html.on("mousedown", ".table-click", WFRP_Utility.handleTableClick.bind(WFRP_Utility));
      html.on("mousedown", ".pay-link", WFRP_Utility.handlePayClick.bind(WFRP_Utility));
      html.on("mousedown", ".credit-link", WFRP_Utility.handleCreditClick.bind(WFRP_Utility));
      html.on("mousedown", ".corruption-link", WFRP_Utility.handleCorruptionClick.bind(WFRP_Utility));
      html.on("mousedown", ".fear-link", WFRP_Utility.handleFearClick.bind(WFRP_Utility));
      html.on("mousedown", ".terror-link", WFRP_Utility.handleTerrorClick.bind(WFRP_Utility));
      html.on("mousedown", ".exp-link", WFRP_Utility.handleExpClick.bind(WFRP_Utility));
      html.on("mousedown", ".travel-click", TravelDistanceWfrp4e.handleTravelClick.bind(TravelDistanceWfrp4e));
      html.on("click", ".item-lookup", this._onItemLookupClicked.bind(this));
      html.on("change", ".card-edit", this._onCardEdit.bind(this));
      html.on("click", ".opposed-toggle", OpposedWFRP.opposedClicked.bind(OpposedWFRP));
      html.on("click", ".species-select", this._onCharGenSpeciesSelect.bind(this));
      html.on("click", ".subspecies-select", this._onCharGenSubspeciesSelect.bind(this));
      html.on("click", ".chargen-button, .chargen-button-nostyle", this._onCharGenButtonClick.bind(this));
      html.on("mousedown", ".overcast-button", this._onOvercastButtonClick.bind(this));
      html.on("mousedown", ".overcast-reset", this._onOvercastResetClicked.bind(this));
      html.on("click", ".career-select", this._onCharGenCareerSelected.bind(this));
      html.on("click", ".unopposed-button", this._onUnopposedButtonClicked.bind(this));
      html.on("click", ".market-button", this._onMarketButtonClicked.bind(this));
      html.on("click", ".haggle", this._onHaggleClicked.bind(this));
      html.on("click", ".corrupt-button", this._onCorruptButtonClicked.bind(this));
      html.on("click", ".fear-button", this._onFearButtonClicked.bind(this));
      html.on("click", ".terror-button", this._onTerrorButtonClicked.bind(this));
      html.on("click", ".experience-button", this._onExpButtonClicked.bind(this));
      html.on("click", ".condition-script", this._onConditionScriptClick.bind(this));
      html.on("click", ".apply-effect", this._onApplyEffectClick.bind(this));
      html.on("click", ".attacker, .defender", this._onOpposedImgClick.bind(this));
      html.on("click", ".apply-condition", this._onApplyCondition.bind(this));
      html.on("click", ".aoe-template", (event2) => {
        AbilityTemplate.fromString(event2.currentTarget.text).drawPreview(event2);
      });
      html.on("click", ".item-property", (event2) => {
        WFRP_Utility.postProperty(event2.target.text);
      });
      html.on("click", ".edit-toggle", (ev) => {
        ev.preventDefault();
        this.toggleEditable(ev.currentTarget);
      });
    }
    static async _onItemLookupClicked(ev) {
      let itemType = $(ev.currentTarget).attr("data-type");
      let location = $(ev.currentTarget).attr("data-location");
      let openMethod = $(ev.currentTarget).attr("data-open") || "post";
      let name = $(ev.currentTarget).attr("data-name");
      let item;
      if (name)
        item = await WFRP_Utility.findItem(name, itemType, location);
      else if (location)
        item = await WFRP_Utility.findItem(ev.currentTarget.text, itemType, location);
      if (!item)
        WFRP_Utility.findItem(ev.currentTarget.text, itemType).then((item2) => {
          if (openMethod == "sheet")
            item2.sheet.render(true);
          else
            item2.postItem();
        });
      else {
        if (openMethod == "sheet")
          item.sheet.render(true);
        else
          item.postItem();
      }
    }
    static _onCardEdit(ev) {
      let button = $(ev.currentTarget), messageId = button.parents(".message").attr("data-message-id"), message2 = game.messages.get(messageId);
      let test = message2.getTest();
      test.context.edited = true;
      test.context.previousResult = duplicate(test.result);
      test.preData[button.attr("data-edit-type")] = parseInt(ev.target.value);
      if (button.attr("data-edit-type") == "hitloc")
        test.preData.roll = $(message2.content).find(".card-content.test-data").attr("data-roll");
      else
        test.preData.hitloc = $(message2.content).find(".card-content.test-data").attr("data-loc");
      if (button.attr("data-edit-type") == "SL") {
        test.preData.roll = $(message2.content).find(".card-content.test-data").attr("data-roll");
        test.preData.slBonus = 0;
        test.preData.successBonus = 0;
      }
      if (button.attr("data-edit-type") == "target")
        test.preData.roll = $(message2.content).find(".card-content.test-data").attr("data-roll");
      test.roll();
    }
    static toggleEditable(html) {
      let elementsToToggle = $(html).parents(".chat-card").find(".display-toggle");
      if (!elementsToToggle.length)
        elementsToToggle = $(html).find(".display-toggle");
      for (let elem of elementsToToggle) {
        if (elem.style.display == "none")
          elem.style.display = "";
        else
          elem.style.display = "none";
      }
    }
    static _onCharGenSpeciesSelect(event2) {
      if (!game.wfrp4e.generator)
        return ui.notifications.error(game.i18n.localize("CHAT.NoGenerator"));
      event2.preventDefault();
      game.wfrp4e.generator.rollSpecies(
        $(event2.currentTarget).parents(".message").attr("data-message-id"),
        $(event2.currentTarget).attr("data-species")
      );
    }
    static _onCharGenSubspeciesSelect(event2) {
      if (!game.wfrp4e.generator)
        return ui.notifications.error(game.i18n.localize("CHAT.NoGenerator"));
      game.wfrp4e.generator.chooseSubspecies($(event2.currentTarget).attr("data-subspecies"));
    }
    static _onCharGenButtonClick(event2) {
      if (!game.wfrp4e.generator)
        return ui.notifications.error(game.i18n.localize("CHAT.NoGenerator"));
      switch ($(event2.currentTarget).attr("data-button")) {
        case "rollSpecies":
          game.wfrp4e.generator.rollSpecies($(event2.currentTarget).parents(".message").attr("data-message-id"));
          break;
        case "rollCareer":
          game.wfrp4e.generator.rollCareer();
          break;
        case "rerollCareer":
          game.wfrp4e.generator.rollCareer(true);
          game.wfrp4e.generator.rollCareer(true);
          break;
        case "chooseCareer":
          game.wfrp4e.generator.chooseCareer();
          break;
        case "rollSpeciesSkillsTalents":
          game.wfrp4e.generator.speciesSkillsTalents();
          break;
        case "rollDetails":
          game.wfrp4e.generator.rollDetails();
          break;
        case "rerollAttributes":
          game.wfrp4e.generator.rollAttributes(true);
          break;
      }
    }
    static _onCharGenCareerSelected(event2) {
      event2.preventDefault();
      if (!game.wfrp4e.generator)
        return ui.notifications.error(game.i18n.localize("CHAT.NoGenerator"));
      let careerSelected = $(event2.currentTarget).attr("data-career");
      let species = $(event2.currentTarget).attr("data-species");
      game.wfrp4e.generator.displayCareer(careerSelected, species, 0, false, true);
    }
    static _onOvercastButtonClick(event2) {
      event2.preventDefault();
      let msg = game.messages.get($(event2.currentTarget).parents(".message").attr("data-message-id"));
      if (!msg.isOwner && !msg.isAuthor)
        return ui.notifications.error("CHAT.EditError");
      let test = msg.getTest();
      let overcastChoice = event2.currentTarget.dataset.overcast;
      test._overcast(overcastChoice);
      if (game.settings.get("wfrp4e", "mooOvercasting")) {
        game.wfrp4e.utility.logHomebrew("mooOvercasting");
      }
    }
    static _onOvercastResetClicked(event2) {
      event2.preventDefault();
      let msg = game.messages.get($(event2.currentTarget).parents(".message").attr("data-message-id"));
      if (!msg.isOwner && !msg.isAuthor)
        return ui.notifications.error("CHAT.EditError");
      let test = msg.getTest();
      test._overcastReset();
      if (game.settings.get("wfrp4e", "mooOvercasting")) {
        game.wfrp4e.utility.logHomebrew("mooOvercasting");
      }
    }
    static _onUnopposedButtonClicked(event2) {
      event2.preventDefault();
      let messageId = $(event2.currentTarget).parents(".message").attr("data-message-id");
      let oppose = game.messages.get(messageId).getOppose();
      oppose.resolveUnopposed();
    }
    static _onMarketButtonClicked(event2) {
      event2.preventDefault();
      let msg = game.messages.get($(event2.currentTarget).parents(".message").attr("data-message-id"));
      switch ($(event2.currentTarget).attr("data-button")) {
        case "rollAvailability":
          MarketWfrp4e.generateSettlementChoice($(event2.currentTarget).attr("data-rarity"));
          break;
        case "payItem":
          if (!game.user.isGM) {
            let actor = game.user.character;
            let itemData;
            if (msg.flags.transfer)
              itemData = JSON.parse(msg.flags.transfer).payload;
            if (actor) {
              let money = MarketWfrp4e.payCommand($(event2.currentTarget).attr("data-pay"), actor);
              if (money) {
                WFRP_Audio.PlayContextAudio({ item: { "type": "money" }, action: "lose" });
                actor.updateEmbeddedDocuments("Item", money);
                if (itemData) {
                  actor.createEmbeddedDocuments("Item", [itemData]);
                  ui.notifications.notify(game.i18n.format("MARKET.ItemAdded", { item: itemData.name, actor: actor.name }));
                }
              }
            } else {
              ui.notifications.notify(game.i18n.localize("MARKET.NotifyNoActor"));
            }
          } else {
            ui.notifications.notify(game.i18n.localize("MARKET.NotifyUserMustBePlayer"));
          }
          break;
        case "creditItem":
          if (!game.user.isGM) {
            let actor = game.user.character;
            if (actor) {
              let dataExchange = $(event2.currentTarget).attr("data-amount");
              let money = MarketWfrp4e.creditCommand(dataExchange, actor);
              if (money) {
                WFRP_Audio.PlayContextAudio({ item: { type: "money" }, action: "gain" });
                actor.updateEmbeddedDocuments("Item", money);
              }
            } else {
              ui.notifications.notify(game.i18n.localize("MARKET.NotifyNoActor"));
            }
          } else {
            ui.notifications.notify(game.i18n.localize("MARKET.NotifyUserMustBePlayer"));
          }
          break;
        case "rollAvailabilityTest":
          let options = {
            settlement: $(event2.currentTarget).attr("data-settlement").toLowerCase(),
            rarity: $(event2.currentTarget).attr("data-rarity").toLowerCase(),
            modifier: 0
          };
          MarketWfrp4e.testForAvailability(options);
          break;
      }
    }
    static _onHaggleClicked(event2) {
      let html = $(event2.currentTarget).parents(".message");
      let msg = game.messages.get(html.attr("data-message-id"));
      let multiplier = $(event2.currentTarget).attr("data-type") == "up" ? 1 : -1;
      let payString = html.find("[data-button=payItem]").attr("data-pay");
      let originalPayString = payString;
      if (!msg.getFlag("wfrp4e", "originalPrice"))
        msg.setFlag("wfrp4e", "originalPrice", payString);
      else
        originalPayString = msg.getFlag("wfrp4e", "originalPrice");
      let originalAmount = MarketWfrp4e.parseMoneyTransactionString(originalPayString);
      let currentAmount = MarketWfrp4e.parseMoneyTransactionString(payString);
      let originalBPAmount = originalAmount.gc * 240 + originalAmount.ss * 12 + originalAmount.bp;
      let bpAmount = currentAmount.gc * 240 + currentAmount.ss * 12 + currentAmount.bp;
      bpAmount += Math.round(originalBPAmount * 0.1) * multiplier;
      let newAmount = MarketWfrp4e.makeSomeChange(bpAmount, 0);
      let newPayString = MarketWfrp4e.amountToString(newAmount);
      html.find("[data-button=payItem]")[0].setAttribute("data-pay", newPayString);
      let newContent = html.find(".message-content").html();
      newContent = newContent.replace(`${currentAmount.gc} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${currentAmount.ss} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${currentAmount.bp} ${game.i18n.localize("MARKET.Abbrev.BP")}`, `${newAmount.gc} ${game.i18n.localize("MARKET.Abbrev.GC")}, ${newAmount.ss} ${game.i18n.localize("MARKET.Abbrev.SS")}, ${newAmount.bp} ${game.i18n.localize("MARKET.Abbrev.BP")}`);
      msg.update({ content: newContent });
    }
    static _onCorruptButtonClicked(event2) {
      let strength = $(event2.currentTarget).attr("data-strength").toLowerCase();
      if (strength != "moderate" && strength != "minor" && strength != "major")
        return ui.notifications.error(game.i18n.localize("ErrorCorruption"));
      let actors = canvas.tokens.controlled.map((t) => t.actor);
      if (actors.length == 0)
        actors = [game.user.character];
      if (actors.length == 0)
        return ui.notifications.error(game.i18n.localize("ErrorCharAssigned"));
      actors.forEach((a) => {
        a.corruptionDialog(strength);
      });
    }
    static _onFearButtonClicked(event2) {
      let value = parseInt($(event2.currentTarget).attr("data-value"));
      let name = $(event2.currentTarget).attr("data-name");
      let targets = canvas.tokens.controlled.concat(Array.from(game.user.targets));
      if (canvas.scene)
        game.user.updateTokenTargets([]);
      if (game.user.isGM) {
        if (!targets.length)
          return ui.notifications.warn(game.i18n.localize("ErrorTarget"));
        targets.forEach((t) => {
          t.actor.applyFear(value, name);
          if (canvas.scene)
            game.user.updateTokenTargets([]);
        });
      } else {
        if (!game.user.character)
          return ui.notifications.warn(game.i18n.localize("ErrorCharAssigned"));
        game.user.character.applyFear(value, name);
      }
    }
    static _onTerrorButtonClicked(event2) {
      let value = parseInt($(event2.currentTarget).attr("data-value"));
      let name = parseInt($(event2.currentTarget).attr("data-name"));
      let targets = canvas.tokens.controlled.concat(Array.from(game.user.targets));
      if (canvas.scene)
        game.user.updateTokenTargets([]);
      if (game.user.isGM) {
        if (!targets.length)
          return ui.notifications.warn(game.i18n.localize("ErrorTarget"));
        targets.forEach((t) => {
          t.actor.applyTerror(value, name);
        });
      } else {
        if (!game.user.character)
          return ui.notifications.warn(game.i18n.localize("ErrorCharAssigned"));
        game.user.character.applyTerror(value, name);
      }
    }
    static _onExpButtonClicked(event2) {
      let amount = parseInt($(event2.currentTarget).attr("data-amount"));
      let reason = $(event2.currentTarget).attr("data-reason");
      let msg = game.messages.get($(event2.currentTarget).parents(".message").attr("data-message-id"));
      let alreadyAwarded = duplicate(msg.getFlag("wfrp4e", "experienceAwarded") || []);
      if (game.user.isGM) {
        if (!game.user.targets.size)
          return ui.notifications.warn(game.i18n.localize("ErrorExp"));
        game.user.targets.forEach((t) => {
          if (!alreadyAwarded.includes(t.actor.id)) {
            t.actor.awardExp(amount, reason);
            alreadyAwarded.push(t.actor.id);
          } else
            ui.notifications.notify(`${t.actor.name} already received this reward.`);
        });
        msg.unsetFlag("wfrp4e", "experienceAwarded").then((m) => {
          msg.setFlag("wfrp4e", "experienceAwarded", alreadyAwarded);
        });
        if (canvas.scene)
          game.user.updateTokenTargets([]);
      } else {
        if (!game.user.character)
          return ui.notifications.warn(game.i18n.localize("ErrorCharAssigned"));
        if (alreadyAwarded.includes(game.user.character.id))
          return ui.notifications.notify(`${game.user.character.name} already received this reward.`);
        alreadyAwarded.push(game.user.character.id);
        game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: msg.id, updateData: { "flags.wfrp4e.experienceAwarded": alreadyAwarded } } });
        game.user.character.awardExp(amount, reason);
      }
    }
    static async _onConditionScriptClick(event2) {
      let condkey = event2.target.dataset["condId"];
      let combatantId = event2.target.dataset["combatantId"];
      let combatant = game.combat.combatants.get(combatantId);
      let msgId2 = $(event2.currentTarget).parents(".message").attr("data-message-id");
      let message2 = game.messages.get(msgId2);
      let conditionResult;
      if (combatant.actor.isOwner)
        conditionResult = await game.wfrp4e.config.conditionScripts[condkey](combatant.actor);
      else
        return ui.notifications.error(game.i18n.localize("CONDITION.ApplyError"));
      if (game.user.isGM)
        message2.update(conditionResult);
      else
        game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: msgId2, updateData: conditionResult } });
    }
    static _onApplyEffectClick(event2) {
      let effectId = event2.target.dataset["effectId"];
      let messageId = $(event2.currentTarget).parents(".message").attr("data-message-id");
      let message2 = game.messages.get(messageId);
      let test = message2.getTest();
      let item = test.item;
      let actor = test.actor;
      if (!actor.isOwner)
        return ui.notifications.error("CHAT.ApplyError");
      let effect = actor.populateEffect(effectId, item, test);
      if (effect.flags.wfrp4e.effectTrigger == "invoke") {
        game.wfrp4e.utility.invokeEffect(actor, effectId, item.id);
        return;
      }
      if (item.range && item.range.value.toLowerCase() == game.i18n.localize("You").toLowerCase() && item.target && item.target.value.toLowerCase() == game.i18n.localize("You").toLowerCase())
        game.wfrp4e.utility.applyEffectToTarget(effect, [{ actor }]);
      else
        game.wfrp4e.utility.applyEffectToTarget(effect);
    }
    static _onOpposedImgClick(event2) {
      let msg = game.messages.get($(event2.currentTarget).parents(".message").attr("data-message-id"));
      let oppose = msg.getOppose();
      let speaker;
      if ($(event2.currentTarget).hasClass("attacker"))
        speaker = oppose.attacker;
      else if ($(event2.currentTarget).hasClass("defender"))
        speaker = oppose.defender;
      speaker.sheet.render(true);
    }
    static _onApplyCondition(event2) {
      let actors = canvas.tokens.controlled.concat(Array.from(game.user.targets)).map((i) => i.actor).filter((i) => i);
      if (actors.length == 0) {
        actors.push(game.user.character);
        ui.notifications.notify(`${game.i18n.format("EFFECT.Applied", { name: game.wfrp4e.config.conditions[event2.currentTarget.dataset.cond] })} ${game.user.character.name}`);
      }
      actors.forEach((a) => {
        a.addCondition(event2.currentTarget.dataset.cond);
      });
    }
  };

  // modules/system/utility-wfrp4e.js
  var WFRP_Utility = class {
    static async loadTablesPath(path) {
      let resp = await FilePicker.browse("data", path);
      let records;
      if (resp.error || !resp.target.includes("tables"))
        throw "";
      for (var file of resp.files) {
        try {
          if (!file.includes(".json"))
            continue;
          let filename = file.substring(file.lastIndexOf("/") + 1, file.indexOf(".json"));
          records = await fetch(file);
          records = await records.json();
          if (records.extend && WFRP_Tables[filename] && WFRP_Tables[filename].columns) {
            WFRP_Tables[filename].columns = WFRP_Tables[filename].columns.concat(records.columns);
            WFRP_Tables[filename].rows.forEach((obj, row) => {
              for (let c of records.columns)
                WFRP_Tables[filename].rows[row].range[c] = records.rows[row].range[c];
            });
          } else if (records.extend && WFRP_Tables[filename] && WFRP_Tables[filename].multi) {
            WFRP_Tables[filename].multi = WFRP_Tables[filename].multi.concat(records.multi);
            WFRP_Tables[filename].rows.forEach((obj, row) => {
              for (let c of records.multi) {
                WFRP_Tables[filename].rows[row][c] = records.rows[row][c];
                WFRP_Tables[filename].rows[row].range[c] = records.rows[row].range[c];
              }
            });
          } else
            WFRP_Tables[filename] = records;
        } catch (error2) {
          console.error("Error reading " + file + ": " + error2);
        }
      }
    }
    static _keepID(id, document2) {
      try {
        let compendium = !!document2.pack;
        let world = !compendium;
        let collection;
        if (compendium) {
          let pack = game.packs.get(document2.pack);
          collection = pack.index;
        } else if (world)
          collection = document2.collection;
        if (collection.has(id)) {
          ui.notifications.notify(`${game.i18n.format("ERROR.ID", { name: document2.name })}`);
          return false;
        } else
          return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
    static propertyStringToArray(propertyString, propertyObject) {
      let newProperties = [];
      let oldProperties = propertyString.split(",").map((i) => i.trim());
      for (let property of oldProperties) {
        if (!property)
          continue;
        let newProperty = {};
        let splitProperty = property.split(" ");
        if (Number.isNumeric(splitProperty[splitProperty.length - 1])) {
          newProperty.value = parseInt(splitProperty[splitProperty.length - 1]);
          splitProperty.splice(splitProperty.length - 1, 1);
        }
        splitProperty = splitProperty.join(" ");
        newProperty.name = game.wfrp4e.utility.findKey(splitProperty, propertyObject);
        if (newProperty)
          newProperties.push(newProperty);
        else
          newProperties.push(property);
      }
      return newProperties;
    }
    static propertyStringToObject(propertyString, propertyObject) {
      let array = this.propertyStringToArray(propertyString, propertyObject);
      return ItemWfrp4e._propertyArrayToObject(array, propertyObject);
    }
    static async speciesCharacteristics(species, average, subspecies) {
      let characteristics = {};
      let characteristicFormulae = game.wfrp4e.config.speciesCharacteristics[species];
      if (subspecies && game.wfrp4e.config.subspecies[species][subspecies].characteristics)
        characteristicFormulae = game.wfrp4e.config.subspecies[species][subspecies].characteristics;
      if (!characteristicFormulae) {
        ui.notifications.info(`${game.i18n.format("ERROR.Species", { name: species })}`);
        WFRP_Utility.log("Could not find species " + species + ": " + error, true);
        throw error;
      }
      for (let char in game.wfrp4e.config.characteristics) {
        if (average) {
          characteristics[char] = { value: parseInt(characteristicFormulae[char].split("+")[1]) + 10, formula: characteristicFormulae[char] };
        } else {
          let roll = await new Roll(characteristicFormulae[char]).roll();
          characteristics[char] = { value: roll.total, formula: characteristicFormulae[char] + ` (${roll.result})` };
        }
      }
      return characteristics;
    }
    static speciesSkillsTalents(species, subspecies) {
      let skills, talents;
      skills = game.wfrp4e.config.speciesSkills[species];
      talents = game.wfrp4e.config.speciesTalents[species];
      if (subspecies && game.wfrp4e.config.subspecies[species][subspecies].skills)
        skills = game.wfrp4e.config.subspecies[species][subspecies].skills;
      if (subspecies && game.wfrp4e.config.subspecies[species][subspecies].talents)
        talents = game.wfrp4e.config.subspecies[species][subspecies].talents;
      return { skills, talents };
    }
    static speciesMovement(species, subspecies) {
      let move = game.wfrp4e.config.speciesMovement[species];
      if (subspecies && game.wfrp4e.config.subspecies[species].movement)
        move = game.wfrp4e.config.subspecies[species].movement;
      return move;
    }
    static findKey(value, obj, options = {}) {
      if (!value || !obj)
        return void 0;
      if (options.caseInsensitive) {
        for (let key in obj) {
          if (obj[key].toLowerCase() == value.toLowerCase())
            return key;
        }
      } else {
        for (let key in obj) {
          if (obj[key] == value)
            return key;
        }
      }
    }
    static getSystemEffects() {
      let systemEffects = duplicate(game.wfrp4e.config.systemEffects);
      Object.keys(systemEffects).map((key, index) => {
        systemEffects[key].obj = "systemEffects";
      });
      let symptomEffects = duplicate(game.wfrp4e.config.symptomEffects);
      Object.keys(symptomEffects).map((key, index) => {
        symptomEffects[key].obj = "symptomEffects";
      });
      mergeObject(systemEffects, symptomEffects);
      return systemEffects;
    }
    static find(name, type) {
      if (type == "skill")
        return game.wfrp4e.utility.findSkill(name);
      if (type == "talent")
        return game.wfrp4e.utility.findTalent(name);
      else
        return game.wfrp4e.utility.findItem(name, type);
    }
    static async findSkill(skillName) {
      skillName = skillName.trim();
      let worldItem = game.items.contents.filter((i) => i.type == "skill" && i.name == skillName)[0];
      if (worldItem)
        return worldItem;
      let skillList = [];
      let packs = game.wfrp4e.tags.getPacksWithTag("skill");
      for (let pack of packs) {
        skillList = pack.indexed ? pack.index : await pack.getIndex();
        let searchResult = skillList.find((s) => s.name == skillName);
        if (!searchResult)
          searchResult = skillList.find((s) => s.name.split("(")[0].trim() == skillName.split("(")[0].trim());
        if (searchResult) {
          let dbSkill;
          await pack.getDocument(searchResult._id).then((packSkill) => dbSkill = packSkill);
          dbSkill.updateSource({ name: skillName });
          return dbSkill;
        }
      }
      throw `"${game.i18n.format("ERROR.NoSkill", { skill: skillName })}"`;
    }
    static async findTalent(talentName) {
      talentName = talentName.trim();
      let worldItem = game.items.contents.filter((i) => i.type == "talent" && i.name == talentName)[0];
      if (worldItem)
        return worldItem;
      let talentList = [];
      let packs = game.wfrp4e.tags.getPacksWithTag("talent");
      for (let pack of packs) {
        talentList = pack.indexed ? pack.index : await pack.getIndex();
        let searchResult = talentList.find((t) => t.name == talentName);
        if (!searchResult)
          searchResult = talentList.find((t) => t.name.split("(")[0].trim() == talentName.split("(")[0].trim());
        if (searchResult) {
          let dbTalent;
          await pack.getDocument(searchResult._id).then((packTalent) => dbTalent = packTalent);
          dbTalent.updateSource({ name: talentName });
          return dbTalent;
        }
      }
      throw `"${game.i18n.format("ERROR.NoTalent", { talent: talentName })}"`;
    }
    static async findItem(itemName, itemType, location = null) {
      itemName = itemName.trim();
      let items;
      if (itemType)
        items = game.items.contents.filter((i) => i.type == itemType);
      else
        items = game.items.contents;
      for (let i of items) {
        if (i.name == itemName && i.type == itemType)
          return i;
      }
      let itemList;
      if (location) {
        let pack = game.packs.find((p) => {
          location.split(".")[0] == p.metadata.package && location.split(".")[1] == p.metadata.name;
        });
        if (pack) {
          const index = pack.indexed ? pack.index : await pack.getIndex();
          itemList = index;
          let searchResult = itemList.find((t) => t.name == itemName);
          if (searchResult)
            return await pack.getDocument(searchResult._id);
        }
      }
      for (let pack of game.wfrp4e.tags.getPacksWithTag(itemType)) {
        const index = pack.indexed ? pack.index : await pack.getIndex();
        itemList = index;
        let searchResult = itemList.find((t) => t.name == itemName);
        if (searchResult)
          return await pack.getDocument(searchResult._id);
      }
    }
    static async findAll(type) {
      let items = game.items.contents.filter((i) => i.type == type);
      for (let p of game.wfrp4e.tags.getPacksWithTag(type)) {
        let content = await p.getDocuments();
        items = items.concat(content.filter((i) => i.type == type));
      }
      return items;
    }
    static nameSorter(a, b) {
      if (a.name.toLowerCase() < b.name.toLowerCase())
        return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase())
        return 1;
      return 0;
    }
    static qualityList() {
      let weapon2 = duplicate(game.wfrp4e.config.weaponQualities);
      let armor = duplicate(game.wfrp4e.config.armorQualities);
      let item = duplicate(game.wfrp4e.config.itemQualities);
      let list = mergeObject(weapon2, mergeObject(item, armor));
      return list;
    }
    static flawList() {
      let weapon2 = duplicate(game.wfrp4e.config.weaponFlaws);
      let armor = duplicate(game.wfrp4e.config.armorFlaws);
      let item = duplicate(game.wfrp4e.config.itemFlaws);
      let list = mergeObject(weapon2, mergeObject(item, armor));
      return list;
    }
    static allProperties() {
      return mergeObject(this.qualityList(), this.flawList());
    }
    static _calculateAdvCost(currentAdvances, type, modifier = 0) {
      let index = Math.floor(currentAdvances / 5);
      index = index < 0 ? 0 : index;
      if (index >= game.wfrp4e.config.xpCost[type].length)
        return game.wfrp4e.config.xpCost[type][game.wfrp4e.config.xpCost[type].length - 1] + modifier;
      return game.wfrp4e.config.xpCost[type][index] + modifier;
    }
    static _calculateAdvRangeCost(start, end, type) {
      let cost = 0;
      let multiplier = 1;
      if (end < start) {
        multiplier = -1;
        let temp = end;
        end = start;
        start = temp;
      }
      while (start < end) {
        cost += this._calculateAdvCost(start, type);
        start++;
      }
      return cost * multiplier;
    }
    static advancementDialog(item, advances, type, actor) {
      let start = item instanceof Item ? item.advances.value : actor.characteristics[item].advances;
      let end = advances;
      let name = item instanceof Item ? item.name : game.wfrp4e.config.characteristics[item];
      return new Promise((resolve) => {
        let xp = this._calculateAdvRangeCost(start, end, type);
        if (xp) {
          new Dialog({
            title: game.i18n.localize("DIALOG.Advancement"),
            content: `
          <p>${game.i18n.localize("DIALOG.AdvancementContent")}</p>
          <div class="form-group">
          <input type="number" value=${xp}>
          </div>
          `,
            buttons: {
              ok: {
                label: game.i18n.localize("Ok"),
                callback: async (dlg) => {
                  xp = Number(dlg.find("input")[0]?.value) || xp;
                  if (xp != 0) {
                    try {
                      let newSpent = actor.details.experience.spent + xp;
                      WFRP_Utility.checkValidAdvancement(actor.details.experience.total, newSpent, game.i18n.localize("ACTOR.ErrorImprove"), name);
                      let log = actor._addToExpLog(xp, `${name} (${end - start})`, newSpent);
                      actor.update({ "system.details.experience.spent": newSpent, "system.details.experience.log": log });
                      resolve(true);
                    } catch (e) {
                      ui.notifications.error(e);
                      resolve(false);
                    }
                  }
                }
              },
              free: {
                label: game.i18n.localize("Free"),
                callback: () => {
                  resolve(true);
                }
              }
            },
            close: () => {
              resolve(false);
            }
          }).render(true);
        } else
          resolve(true);
      });
    }
    static memorizeCostDialog(spell, actor) {
      return new Promise((resolve) => {
        let xp = this.calculateSpellCost(spell, actor);
        if (xp) {
          new Dialog({
            title: game.i18n.localize("DIALOG.MemorizeSpell"),
            content: `<p>${game.i18n.format("DIALOG.MemorizeSpellContent", { xp })}</p>`,
            buttons: {
              ok: {
                label: game.i18n.localize("Ok"),
                callback: () => {
                  let newSpent = actor.details.experience.spent + xp;
                  let log = actor._addToExpLog(xp, game.i18n.format("LOG.MemorizedSpell", { name: spell.name }), newSpent);
                  actor.update({ "system.details.experience.spent": newSpent, "system.details.experience.log": log });
                  resolve(true);
                }
              },
              free: {
                label: game.i18n.localize("Free"),
                callback: () => {
                  resolve(true);
                }
              }
            },
            close: () => {
              resolve(false);
            }
          }).render(true);
        } else
          resolve(true);
      });
    }
    static miracleGainedDialog(miracle, actor) {
      let xp = 100 * actor.getItemTypes("prayer").filter((p) => p.prayerType.value == "miracle").length;
      if (xp) {
        new Dialog({
          title: game.i18n.localize("DIALOG.GainPrayer"),
          content: `<p>${game.i18n.format("DIALOG.GainPrayerContent", { xp })}</p>`,
          buttons: {
            ok: {
              label: game.i18n.localize("Ok"),
              callback: () => {
                let newSpent = actor.details.experience.spent + xp;
                let log = actor._addToExpLog(xp, game.i18n.format("LOG.GainPrayer", { name: miracle.name }), newSpent);
                actor.update({ "system.details.experience.spent": newSpent, "system.details.experience.log": log });
              }
            },
            free: {
              label: game.i18n.localize("Free"),
              callback: () => {
              }
            }
          }
        }).render(true);
      }
    }
    static calculateSpellCost(spell, actor) {
      let cost = 0;
      let bonus = 0;
      let currentlyKnown = 0;
      if (["slaanesh", "tzeentch", "nurgle"].includes(spell.lore.value))
        return 0;
      if (spell.lore.value == "petty")
        bonus = actor.characteristics.wp.bonus;
      else
        bonus = actor.characteristics.int.bonus;
      if (spell.lore.value != "petty") {
        currentlyKnown = actor.getItemTypes("spell").filter((i) => i.lore.value == spell.lore.value && i.memorized.value).length;
      } else if (spell.lore.value == "petty") {
        currentlyKnown = actor.getItemTypes("spell").filter((i) => i.lore.value == spell.lore.value).length;
        if (currentlyKnown < bonus)
          return 0;
      }
      let costKey = currentlyKnown;
      if (spell.lore.value != "petty")
        costKey++;
      cost = Math.ceil(costKey / bonus) * 100;
      if (spell.lore.value == "petty")
        cost *= 0.5;
      return cost;
    }
    static postSymptom(symptom) {
      let symkey = WFRP_Utility.findKey(symptom.split("(")[0].trim(), game.wfrp4e.config.symptoms);
      let content = `<b>${symptom}</b>: ${game.wfrp4e.config.symptomDescriptions[symkey]}`;
      let chatOptions = {
        user: game.user.id,
        rollMode: game.settings.get("core", "rollMode"),
        content
      };
      if (["gmroll", "blindroll"].includes(chatOptions.rollMode))
        chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
      if (chatOptions.rollMode === "blindroll")
        chatOptions["blind"] = true;
      ChatMessage.create(chatOptions);
      if (game.user.isGM) {
        content = `<b>${symptom} ${game.i18n.localize("Treatment")}</b>: ${game.wfrp4e.config.symptomTreatment[symkey]}`;
        chatOptions = {
          user: game.user.id,
          rollMode: game.settings.get("core", "rollMode"),
          content
        };
        chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
        ChatMessage.create(chatOptions);
      }
    }
    static postProperty(property) {
      let properties = mergeObject(WFRP_Utility.qualityList(), WFRP_Utility.flawList()), propertyDescr = Object.assign(duplicate(game.wfrp4e.config.qualityDescriptions), game.wfrp4e.config.flawDescriptions), propertyKey;
      property = this.parsePropertyName(property.replace(/,/g, "").trim());
      propertyKey = WFRP_Utility.findKey(property, properties);
      let propertyDescription = `<b>${property}:</b><br>${propertyDescr[propertyKey]}`;
      propertyDescription = propertyDescription.replace("(Rating)", property.split(" ")[1]);
      let chatOptions = {
        user: game.user.id,
        rollMode: game.settings.get("core", "rollMode"),
        content: propertyDescription
      };
      if (["gmroll", "blindroll"].includes(chatOptions.rollMode))
        chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
      if (chatOptions.rollMode === "blindroll")
        chatOptions["blind"] = true;
      ChatMessage.create(chatOptions);
    }
    static parsePropertyName(property) {
      property = property.trim();
      if (!isNaN(property[property.length - 1]))
        return property.substring(0, property.length - 2).trim();
      else if (property.includes("("))
        return property.split("(")[0].trim();
      else
        return property;
    }
    static chatDataSetup(content, modeOverride, isRoll = false, forceWhisper) {
      let chatData = {
        user: game.user.id,
        rollMode: modeOverride || game.settings.get("core", "rollMode"),
        content
      };
      if (isRoll)
        chatData.sound = CONFIG.sounds.dice;
      if (["gmroll", "blindroll"].includes(chatData.rollMode))
        chatData["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
      if (chatData.rollMode === "blindroll")
        chatData["blind"] = true;
      else if (chatData.rollMode === "selfroll")
        chatData["whisper"] = [game.user];
      if (forceWhisper) {
        chatData["speaker"] = ChatMessage.getSpeaker();
        chatData["whisper"] = ChatMessage.getWhisperRecipients(forceWhisper);
      }
      return chatData;
    }
    static matchClosest(object, query, options = {}) {
      query = query.toLowerCase();
      let keys = Object.keys(object);
      let match = [];
      for (let key of keys) {
        let percentage = 0;
        let matchCounter = 0;
        let myword;
        if (options.matchKeys)
          myword = key.toLowerCase();
        else
          myword = object[key].toLowerCase();
        for (let i = 0; i < myword.length; i++) {
          if (myword[i] == query[i]) {
            matchCounter++;
          }
        }
        percentage = matchCounter / key.length;
        match.push(percentage);
      }
      let maxIndex = match.indexOf(Math.max.apply(Math, match));
      return keys[maxIndex];
    }
    static getSpeaker(speaker) {
      let actor = game.actors.get(speaker.actor);
      if (speaker.token)
        actor = game.scenes.get(speaker.scene).tokens.get(speaker.token).actor;
      return actor;
    }
    static getToken(speaker) {
      return game.scenes.get(speaker?.scene)?.tokens?.get(speaker?.token);
    }
    static async allBasicSkills() {
      let returnSkills = [];
      const packs = game.wfrp4e.tags.getPacksWithTag(["money", "skill"]);
      if (!packs.length)
        return ui.notifications.error(game.i18n.localize("ERROR.Found"));
      for (let pack of packs) {
        let items;
        await pack.getDocuments().then((content) => items = content.filter((i) => i.type == "skill"));
        for (let i of items) {
          if (i.system.advanced.value == "bsc") {
            if (i.system.grouped.value != "noSpec") {
              let skill = i.toObject();
              let startParen = skill.name.indexOf("(");
              skill.name = skill.name.substring(0, startParen).trim();
              if (returnSkills.filter((x) => x.name.includes(skill.name)).length <= 0)
                returnSkills.push(skill);
            } else
              returnSkills.push(i.toObject());
          }
        }
      }
      return returnSkills;
    }
    static async allMoneyItems() {
      let moneyItems = [];
      const packs = game.wfrp4e.tags.getPacksWithTag("money");
      if (!packs.length)
        return ui.notifications.error(game.i18n.localize("ERROR.Found"));
      for (let pack of packs) {
        let items;
        await pack.getDocuments().then((content) => items = content.filter((i) => i.type == "money").map((i) => i.toObject()));
        let money = items.filter((t) => Object.values(game.wfrp4e.config.moneyNames).map((n) => n.toLowerCase()).includes(t.name.toLowerCase()));
        moneyItems = moneyItems.concat(money);
      }
      return moneyItems;
    }
    static hasTag(pack, tag) {
    }
    static alterDifficulty(difficulty, steps) {
      let difficulties = Object.keys(game.wfrp4e.config.difficultyLabels);
      let difficultyIndex = difficulties.findIndex((d) => d == difficulty) + steps;
      difficultyIndex = Math.clamped(difficultyIndex, 0, difficulties.length - 1);
      return difficulties[difficultyIndex];
    }
    static _replaceCustomLink(match, entityType, id, name) {
      let ids = id.split(",");
      switch (entityType) {
        case "Roll":
          return `<a class="chat-roll" data-roll="${ids[0]}"><i class='fas fa-dice'></i> ${name ? name : id}</a>`;
        case "Table":
          return `<a class = "table-click" data-table="${ids[0]}"><i class="fas fa-list"></i> ${game.wfrp4e.tables.findTable(id)?.name && !name ? game.wfrp4e.tables.findTable(id)?.name : name}</a>`;
        case "Symptom":
          return `<a class = "symptom-tag" data-symptom="${ids[0]}"><i class='fas fa-user-injured'></i> ${name ? name : id}</a>`;
        case "Condition":
          return `<a class = "condition-chat" data-cond="${ids[0]}"><i class='fas fa-user-injured'></i> ${name ? name : id}</a>`;
        case "Pay":
          return `<a class = "pay-link" data-pay="${ids[0]}"><i class="fas fa-coins"></i> ${name ? name : id}</a>`;
        case "Credit":
          return `<a class = "credit-link" data-credit="${ids[0]}"><i class="fas fa-coins"></i> ${name ? name : id}</a>`;
        case "Corruption":
          return `<a class = "corruption-link" data-strength="${ids[0]}"><img src="systems/wfrp4e/ui/chaos.svg" height=15px width=15px style="border:none"> ${name ? name : id}</a>`;
        case "Fear":
          return `<a class = "fear-link" data-value="${ids[0]}" data-name="${ids[1] || ""}"><img src="systems/wfrp4e/ui/fear.svg" height=15px width=15px style="border:none"> ${entityType} ${ids[0]}</a>`;
        case "Terror":
          return `<a class = "terror-link" data-value="${ids[0]}" data-name="${ids[1] || ""}"><img src="systems/wfrp4e/ui/terror.svg" height=15px width=15px style="border:none"> ${entityType} ${ids[0]}</a>`;
        case "Exp":
          return `<a class = "exp-link" data-amount="${ids[0]}" data-reason="${ids[1] || ""}"><i class="fas fa-plus"></i> ${name ? name : ids[1] || ids[0]}</a>`;
      }
    }
    static async handleTableClick(event2) {
      let modifier = parseInt($(event2.currentTarget).attr("data-modifier")) || 0;
      let html;
      let chatOptions = this.chatDataSetup("", game.settings.get("core", "rollMode"), true);
      if (event2.button == 0) {
        let clickText = event2.target.text || event2.target.textContent;
        if (clickText.trim() == game.i18n.localize("ROLL.CritCast")) {
          html = game.wfrp4e.tables.criticalCastMenu($(event2.currentTarget).attr("data-table"));
        } else if (clickText.trim() == game.i18n.localize("ROLL.TotalPower"))
          html = game.wfrp4e.tables.restrictedCriticalCastMenu();
        else if ($(event2.currentTarget).attr("data-table") == "misfire") {
          let damage = $(event2.currentTarget).attr("data-damage");
          html = game.i18n.format("ROLL.Misfire", { damage });
        } else
          html = await game.wfrp4e.tables.formatChatRoll(
            $(event2.currentTarget).attr("data-table"),
            {
              modifier
            },
            $(event2.currentTarget).attr("data-column")
          );
        chatOptions["content"] = html;
        chatOptions["type"] = 0;
        if (html)
          ChatMessage.create(chatOptions);
      }
    }
    static handleConditionClick(event2) {
      let cond = $(event2.currentTarget).attr("data-cond");
      if (!cond)
        cond = event2.target.text.trim();
      if (!isNaN(cond.split(" ").pop()))
        cond = cond.split(" ").slice(0, -1).join(" ");
      let condkey = WFRP_Utility.findKey(cond, game.wfrp4e.config.conditions, { caseInsensitive: true });
      let condName = game.wfrp4e.config.conditions[condkey];
      let condDescr = game.wfrp4e.config.conditionDescriptions[condkey];
      let messageContent = `<b>${condName}</b><br>${condDescr}`;
      messageContent = ChatWFRP.addEffectButtons(messageContent, [condkey]);
      let chatData = WFRP_Utility.chatDataSetup(messageContent);
      ChatMessage.create(chatData);
    }
    static handleSymptomClick(event2) {
      let symptom = $(event2.currentTarget).attr("data-symptom");
      if (!symptom)
        symptom = event2.target.text;
      WFRP_Utility.postSymptom(symptom);
    }
    static async handleRollClick(event2) {
      let roll = $(event2.currentTarget).attr("data-roll");
      if (!roll)
        roll = event2.target.text.trim();
      let rollMode = game.settings.get("core", "rollMode");
      (await new Roll(roll).roll()).toMessage(
        {
          user: game.user.id,
          rollMode
        }
      );
    }
    static handlePayClick(event2) {
      let payString = $(event2.currentTarget).attr("data-pay");
      if (game.user.isGM)
        MarketWfrp4e.generatePayCard(payString);
    }
    static handleCreditClick(event2) {
      let creditString = $(event2.currentTarget).attr("data-credit");
      let amt = creditString.split(" ")[0];
      let option = creditString.split(" ")[1];
      if (game.user.isGM)
        MarketWfrp4e.generateCreditCard(amt, option);
    }
    static handleCorruptionClick(event2) {
      return this.postCorruptionTest($(event2.currentTarget).attr("data-strength"));
    }
    static postCorruptionTest(strength) {
      renderTemplate("systems/wfrp4e/templates/chat/corruption.html", { strength }).then((html) => {
        ChatMessage.create({ content: html });
      });
    }
    static handleFearClick(event2) {
      let target = $(event2.currentTarget);
      return this.postFear(target.attr("data-value"), target.attr("data-name"));
    }
    static postFear(value = 0, name = void 0) {
      if (isNaN(value))
        value = 0;
      let title = `${game.i18n.localize("CHAT.Fear")} ${value}`;
      if (name)
        title += ` - ${name}`;
      renderTemplate("systems/wfrp4e/templates/chat/fear.html", { value, name, title }).then((html) => {
        ChatMessage.create({ content: html, speaker: { alias: name } });
      });
    }
    static handleTerrorClick(event2) {
      let target = $(event2.currentTarget);
      return this.postTerror(target.attr("data-value"), target.attr("data-name"));
    }
    static handleExpClick(event2) {
      let target = $(event2.currentTarget);
      return this.postExp(target.attr("data-amount"), target.attr("data-reason"));
    }
    static postTerror(value = 1, name = void 0) {
      if (isNaN(value))
        value = 1;
      let title = `${game.i18n.localize("CHAT.Terror")} ${value}`;
      if (name)
        title += ` - ${name}`;
      renderTemplate("systems/wfrp4e/templates/chat/terror.html", { value, name, title }).then((html) => {
        ChatMessage.create({ content: html, speaker: { alias: name } });
      });
    }
    static postExp(amount, reason = void 0) {
      if (isNaN(amount))
        return ui.notifications.error(game.i18n.localize("ERROR.Experience"));
      let title = `${game.i18n.localize("CHAT.Experience")}`;
      renderTemplate("systems/wfrp4e/templates/chat/experience.html", { title, amount, reason }).then((html) => {
        ChatMessage.create({ content: html });
      });
    }
    static _onDragConditionLink(event2) {
      event2.stopPropagation();
      const a = event2.currentTarget;
      let dragData = null;
      dragData = { type: "condition", payload: a.dataset.cond };
      event2.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }
    static applyEffectToTarget(effect, targets) {
      if (!targets && !game.user.targets.size)
        return ui.notifications.warn(game.i18n.localize("WARNING.Target"));
      if (!targets)
        targets = Array.from(game.user.targets);
      if (canvas.scene)
        game.user.updateTokenTargets([]);
      if (game.user.isGM) {
        setProperty(effect, "flags.wfrp4e.effectApplication", "");
        setProperty(effect, "flags.core.statusId", effect.label.toLowerCase());
        let msg = `${game.i18n.format("EFFECT.Applied", { name: effect.label })} `;
        let actors = [];
        if (effect.flags.wfrp4e.effectTrigger == "oneTime") {
          targets.forEach((t) => {
            actors.push(t.actor.prototypeToken.name);
            game.wfrp4e.utility.applyOneTimeEffect(effect, t.actor);
          });
        } else {
          targets.forEach((t) => {
            actors.push(t.actor.prototypeToken.name);
            t.actor.createEmbeddedDocuments("ActiveEffect", [effect]);
          });
        }
        msg += actors.join(", ");
        ui.notifications.notify(msg);
      } else {
        ui.notifications.notify(game.i18n.localize("APPLYREQUESTGM"));
        game.socket.emit("system.wfrp4e", { type: "applyEffects", payload: { effect, targets: [...targets].map((t) => t.document.toObject()), scene: canvas.scene.id } });
      }
    }
    static applyOneTimeEffect(effect, actor) {
      if (game.user.isGM) {
        if (actor.hasPlayerOwner) {
          for (let u of game.users.contents.filter((u2) => u2.active && !u2.isGM)) {
            if (actor.ownersip.default >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || actor.ownersip[u.id] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
              ui.notifications.notify(game.i18n.localize("APPLYREQUESTOWNER"));
              let effectObj = effect instanceof ActiveEffect ? effect.toObject() : effect;
              game.socket.emit("system.wfrp4e", { type: "applyOneTimeEffect", payload: { userId: u.id, effect: effectObj, actorData: actor.toObject() } });
              return;
            }
          }
        }
      }
      let asyncFunction = Object.getPrototypeOf(async function() {
      }).constructor;
      let func = new asyncFunction("args", getProperty(effect, "flags.wfrp4e.script")).bind({ actor, effect });
      func({ actor });
    }
    static invokeEffect(actor, effectId, itemId) {
      let item, effect;
      if (itemId) {
        item = actor.items.get(itemId);
        effect = item.effects.get(effectId);
      } else {
        effect = actor.actorEffects.get(effectId);
        item = effect.item;
      }
      effect.reduceItemQuantity();
      let asyncFunction = Object.getPrototypeOf(async function() {
      }).constructor;
      let func = new asyncFunction("args", getProperty(effect, "flags.wfrp4e.script")).bind({ actor, effect, item });
      func({ actor, effect, item });
    }
    static rollItemMacro(itemName, itemType, bypassData) {
      const speaker = ChatMessage.getSpeaker();
      let actor;
      if (speaker.token)
        actor = game.actors.tokens[speaker.token];
      if (!actor)
        actor = game.actors.get(speaker.actor);
      let item;
      if (itemType == "characteristic") {
        return actor.setupCharacteristic(itemName, bypassData).then((test) => test.roll());
      } else {
        item = actor ? actor.getItemTypes(itemType).find((i) => i.name === itemName) : null;
      }
      if (!item)
        return ui.notifications.warn(`${game.i18n.localize("ErrorMacroItemMissing")} ${itemName}`);
      switch (item.type) {
        case "weapon":
          return actor.setupWeapon(item, bypassData).then((test) => test.roll());
        case "spell":
          return actor.sheet.spellDialog(item, bypassData);
        case "prayer":
          return actor.setupPrayer(item, bypassData).then((test) => test.roll());
        case "trait":
          return actor.setupTrait(item, bypassData).then((test) => test.roll());
        case "skill":
          return actor.setupSkill(item, bypassData).then((test) => test.roll());
      }
    }
    static async toggleMorrslieb() {
      let morrsliebActive = canvas.scene.getFlag("wfrp4e", "morrslieb");
      morrsliebActive = !morrsliebActive;
      await canvas.scene.setFlag("wfrp4e", "morrslieb", morrsliebActive);
      if (game.modules.get("fxmaster") && game.modules.get("fxmaster").active) {
        FXMASTER.filters.switch("morrslieb", "color", CONFIG.MorrsliebObject);
      } else {
        game.socket.emit("system.wfrp4e", {
          type: "morrslieb"
        });
        canvas.draw();
      }
    }
    static _packageTables() {
      let tables = {};
      let tableValues = Object.values(game.wfrp4e.tables);
      let tableKeys = Object.keys(game.wfrp4e.tables);
      tableKeys.forEach((key, index) => {
        tables[key] = tableValues[index];
      });
      return tables;
    }
    static async convertWFRPTable(tableId) {
      let table = game.wfrp4e.tables[tableId];
      let rollTable;
      if (table.columns || table.multi) {
        rollTable = [];
        if (table.multi) {
          for (let column of table.multi) {
            let rollTableColumn = new CONFIG.RollTable.documentClass({ name: table.name + " - " + column }).toObject();
            rollTableColumn["flags.wfrp4e.key"] = tableId;
            rollTableColumn["flags.wfrp4e.column"] = column;
            rollTableColumn.formula = table.die || "1d100";
            rollTableColumn.results = table.rows.map((i) => {
              let row = duplicate(i[column]);
              row.range = i.range[column];
              if (row.range.length == 1)
                row.range.push(row.range[0]);
              return this._convertTableRow(row);
            });
            rollTableColumn.results = rollTableColumn.results.filter((i) => i.range.length);
            rollTable.push(rollTableColumn);
          }
        }
        if (table.columns) {
          for (let column of table.columns) {
            let rollTableColumn = new CONFIG.RollTable.documentClass({ name: table.name + " - " + column }).toObject();
            rollTableColumn["flags.wfrp4e.key"] = tableId;
            rollTableColumn["flags.wfrp4e.column"] = column;
            rollTableColumn.formula = table.die || "1d100";
            rollTableColumn.results = table.rows.map((i) => {
              let row = duplicate(i);
              row.range = row.range[column];
              if (row.range.length == 1)
                row.range.push(row.range[0]);
              return this._convertTableRow(row);
            });
            rollTableColumn.results = rollTableColumn.results.filter((i) => i.range.length);
            rollTable.push(rollTableColumn);
          }
        }
      } else {
        rollTable = new CONFIG.RollTable.documentClass({ name: table.name }).toObject();
        rollTable["flags.wfrp4e.key"] = tableId;
        rollTable.formula = table.die || "1d100";
        rollTable.results = table.rows.map((i) => this._convertTableRow(i));
      }
      return RollTable.create(rollTable);
    }
    static _convertTableRow(row) {
      let newRow = new TableResult().toObject();
      newRow.range = row.range;
      let text = ``;
      if (row.name && row.description) {
        text += `<b>${row.name}</b>: `;
        text += row.description;
      } else if (row.name)
        text += row.name;
      else if (row.description)
        text += row.description;
      newRow.text = text;
      return newRow;
    }
    static checkValidAdvancement(total, spent, action, item) {
      if (total - spent < 0) {
        throw new Error(game.i18n.format("ACTOR.AdvancementError", { action, item }));
      }
    }
    static updateGroupAdvantage({ players = void 0, enemies = void 0 } = {}) {
      if (!game.user.isGM) {
        game.socket.emit("system.wfrp4e", { type: "changeGroupAdvantage", payload: { players, enemies } });
      } else {
        let advantage = game.settings.get("wfrp4e", "groupAdvantageValues");
        if (Number.isNumeric(players))
          advantage.players = players;
        if (Number.isNumeric(enemies))
          advantage.enemies = enemies;
        return game.settings.set("wfrp4e", "groupAdvantageValues", advantage);
      }
    }
    static optimalDifference(weapon2, range) {
      let keys = Object.keys(game.wfrp4e.config.rangeBands);
      let rangeKey = this.findKey(range, game.wfrp4e.config.rangeBands);
      let weaponRange = weapon2.getFlag("wfrp4e", "optimalRange");
      if (!weaponRange || !rangeKey)
        return 1;
      return Math.abs(keys.findIndex((i) => i == rangeKey) - keys.findIndex((i) => i == weaponRange));
    }
    static log(message2, force = false, args) {
      if (CONFIG.debug.wfrp4e || force)
        console.log(`%cWFRP4e%c | ${message2}`, "color: gold", "color: unset", args || "");
    }
    static logHomebrew(message2) {
      this.log("Applying Homebrew Rule: " + message2, true);
    }
  };
  Hooks.on("renderFilePicker", (app, html, data) => {
    if (data.target.includes("systems") || data.target.includes("modules")) {
      html.find("input[name='upload']").css("display", "none");
      let label = html.find(".upload-file label");
      label.text("Upload Disabled");
      label.attr("title", "Upload disabled while in system directory. DO NOT put your assets within any system or module folder.");
    }
  });

  // modules/apps/market-wfrp4e.js
  var MarketWfrp4e = class {
    static async testForAvailability({ settlement, rarity, modifier }) {
      let validSettlements = Object.getOwnPropertyNames(game.wfrp4e.config.availabilityTable);
      let validSettlementsLocalized = {};
      let validRarityLocalized = {};
      validSettlements.forEach(function(index) {
        validSettlementsLocalized[game.i18n.localize(index).toLowerCase()] = index;
      });
      if (settlement && validSettlementsLocalized.hasOwnProperty(settlement)) {
        let validRarity = Object.getOwnPropertyNames(game.wfrp4e.config.availabilityTable[validSettlementsLocalized[settlement]]);
        validRarity.forEach(function(index) {
          validRarityLocalized[game.i18n.localize(index).toLowerCase()] = index;
        });
      }
      let msg = `<h3><b>${game.i18n.localize("MARKET.AvailabilityTest")}</b></h3>`;
      if (!settlement || !rarity || !validSettlementsLocalized.hasOwnProperty(settlement) || !validRarityLocalized.hasOwnProperty(rarity)) {
        msg += `<p>${game.i18n.localize("MARKET.AvailWrongCommand")}</p><p><i>${game.i18n.localize("MARKET.AvailCommandExample")}</i></p>`;
      } else {
        let roll = await new Roll("1d100 - @modifier", { modifier }).roll();
        let availabilityLookup = game.wfrp4e.config.availabilityTable[validSettlementsLocalized[settlement]][validRarityLocalized[rarity]];
        let isAvailable = availabilityLookup.test > 0 && roll.total <= availabilityLookup.test;
        let finalResult = {
          settlement: settlement.charAt(0).toUpperCase() + settlement.slice(1),
          rarity: rarity.charAt(0).toUpperCase() + rarity.slice(1),
          instock: isAvailable ? game.i18n.localize("Yes") : game.i18n.localize("No"),
          quantity: isAvailable ? availabilityLookup.stock : 0,
          roll: roll.total
        };
        if (availabilityLookup.stock.includes("d")) {
          let stockRoll = await new Roll(availabilityLookup.stock).roll();
          finalResult.quantity = stockRoll.total;
        }
        msg += this.formatTestForChat(finalResult);
      }
      ChatMessage.create(WFRP_Utility.chatDataSetup(msg, "roll", true));
    }
    static formatTestForChat(result) {
      return `
        <b>${game.i18n.localize("MARKET.SettlementSize")}</b> ${result.settlement}<br>
        <b>${game.i18n.localize("MARKET.Rarity")}</b> ${result.rarity}<br><br>
        <b>${game.i18n.localize("MARKET.InStock")}</b> ${result.instock}<br>
        <b>${game.i18n.localize("MARKET.QuantityAvailable")}</b> ${result.quantity}<br>
        <b>${game.i18n.localize("Roll")}:</b> ${result.roll}
      `;
    }
    static generateSettlementChoice(rarity) {
      let cardData = { rarity: game.wfrp4e.config.availability[rarity] };
      renderTemplate("systems/wfrp4e/templates/chat/market/market-settlement.html", cardData).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html, "selfroll");
        ChatMessage.create(chatData);
      });
    }
    static consolidateMoney(money) {
      money.sort((a, b) => b.system.coinValue.value - a.system.coinValue.value);
      let brass = 0;
      for (let m of money)
        brass += m.system.quantity.value * m.system.coinValue.value;
      for (let m of money) {
        if (m.system.coinValue.value <= 0)
          break;
        m.system.quantity.value = Math.trunc(brass / m.system.coinValue.value);
        brass = brass % m.system.coinValue.value;
      }
      return money;
    }
    static creditCommand(amount, actor, options = {}) {
      let moneyItemInventory = actor.getItemTypes("money").map((i) => i.toObject());
      let moneyToSend = this.parseMoneyTransactionString(amount);
      let msg = `<h3><b>${game.i18n.localize("MARKET.CreditCommand")}</b></h3>`;
      let errorOccured = false;
      if (!moneyToSend) {
        msg += `<p>${game.i18n.localize("MARKET.MoneyTransactionWrongCommand")}</p><p><i>${game.i18n.localize("MARKET.CreditCommandExample")}</i></p>`;
        errorOccured = true;
      } else {
        let characterMoney = this.getCharacterMoney(moneyItemInventory);
        this.checkCharacterMoneyValidity(moneyItemInventory, characterMoney);
        if (Object.values(characterMoney).includes(false)) {
          msg += `<p>${game.i18n.localize("MARKET.CantFindMoneyItems")}</p>`;
          errorOccured = true;
        } else {
          moneyItemInventory[characterMoney.gc].system.quantity.value += moneyToSend.gc;
          moneyItemInventory[characterMoney.ss].system.quantity.value += moneyToSend.ss;
          moneyItemInventory[characterMoney.bp].system.quantity.value += moneyToSend.bp;
        }
      }
      if (errorOccured)
        moneyItemInventory = false;
      else {
        msg += game.i18n.format("MARKET.Credit", {
          number1: moneyToSend.gc,
          number2: moneyToSend.ss,
          number3: moneyToSend.bp
        });
        msg += `<br><b>${game.i18n.localize("MARKET.ReceivedBy")}</b> ${actor.name}`;
        this.throwMoney(moneyToSend);
      }
      if (options.suppressMessage)
        ui.notifications.notify(`${actor.name} received ${moneyToSend.gc}${game.i18n.localize("MARKET.Abbrev.GC")} ${moneyToSend.ss}${game.i18n.localize("MARKET.Abbrev.SS")} ${moneyToSend.bp}${game.i18n.localize("MARKET.Abbrev.BP")}`);
      else
        ChatMessage.create(WFRP_Utility.chatDataSetup(msg, "roll"));
      return moneyItemInventory;
    }
    static payCommand(command, actor, options = {}) {
      let moneyItemInventory = actor.getItemTypes("money").map((i) => i.toObject());
      let moneyToPay = this.parseMoneyTransactionString(command);
      let msg = `<h3><b>${game.i18n.localize("MARKET.PayCommand")}</b></h3>`;
      let errorOccured = false;
      if (!moneyToPay) {
        msg += `<p>${game.i18n.localize("MARKET.MoneyTransactionWrongCommand")}</p><p><i>${game.i18n.localize("MARKET.PayCommandExample")}</i></p>`;
        errorOccured = true;
      } else {
        let characterMoney = this.getCharacterMoney(moneyItemInventory);
        this.checkCharacterMoneyValidity(moneyItemInventory, characterMoney);
        if (Object.values(characterMoney).includes(false)) {
          msg += `<p>${game.i18n.localize("MARKET.CantFindMoneyItems")}</p>`;
          errorOccured = true;
        } else {
          if (moneyToPay.gc <= moneyItemInventory[characterMoney.gc].system.quantity.value && moneyToPay.ss <= moneyItemInventory[characterMoney.ss].system.quantity.value && moneyToPay.bp <= moneyItemInventory[characterMoney.bp].system.quantity.value) {
            moneyItemInventory[characterMoney.gc].system.quantity.value -= moneyToPay.gc;
            moneyItemInventory[characterMoney.ss].system.quantity.value -= moneyToPay.ss;
            moneyItemInventory[characterMoney.bp].system.quantity.value -= moneyToPay.bp;
          } else {
            let totalBPAvailable = 0;
            for (let m of moneyItemInventory)
              totalBPAvailable += m.system.quantity.value * m.system.coinValue.value;
            let totalBPPay = moneyToPay.gc * 240 + moneyToPay.ss * 12 + moneyToPay.bp;
            if (totalBPAvailable < totalBPPay) {
              msg += `${game.i18n.localize("MARKET.NotEnoughMoney")}<br>
              <b>${game.i18n.localize("MARKET.MoneyNeeded")}</b> ${totalBPPay} ${game.i18n.localize("NAME.BP")}<br>
              <b>${game.i18n.localize("MARKET.MoneyAvailable")}</b> ${totalBPAvailable} ${game.i18n.localize("NAME.BP")}`;
              errorOccured = true;
            } else {
              totalBPAvailable -= totalBPPay;
              moneyItemInventory[characterMoney.gc].system.quantity.value = 0;
              moneyItemInventory[characterMoney.ss].system.quantity.value = 0;
              moneyItemInventory[characterMoney.bp].system.quantity.value = totalBPAvailable;
              moneyItemInventory = this.consolidateMoney(moneyItemInventory);
            }
          }
        }
      }
      if (errorOccured)
        moneyItemInventory = false;
      else {
        msg += game.i18n.format("MARKET.Paid", {
          number1: moneyToPay.gc,
          number2: moneyToPay.ss,
          number3: moneyToPay.bp
        });
        msg += `<br><b>${game.i18n.localize("MARKET.PaidBy")}</b> ${actor.name}`;
        this.throwMoney(moneyToPay);
      }
      if (options.suppressMessage)
        ui.notifications.notify(msg);
      else
        ChatMessage.create(WFRP_Utility.chatDataSetup(msg, "roll"));
      return moneyItemInventory;
    }
    static checkCharacterMoneyValidity(moneyItemInventory, characterMoney) {
      for (let m = 0; m < moneyItemInventory.length; m++) {
        switch (moneyItemInventory[m].system.coinValue.value) {
          case 240:
            if (characterMoney.gc === false)
              characterMoney.gc = m;
            break;
          case 12:
            if (characterMoney.ss === false)
              characterMoney.ss = m;
            break;
          case 1:
            if (characterMoney.bp === false)
              characterMoney.bp = m;
            break;
        }
      }
    }
    static getCharacterMoney(moneyItemInventory) {
      let moneyTypeIndex = {
        gc: false,
        ss: false,
        bp: false
      };
      for (let m = 0; m < moneyItemInventory.length; m++) {
        switch (moneyItemInventory[m].name) {
          case game.i18n.localize("NAME.GC"):
            moneyTypeIndex.gc = m;
            break;
          case game.i18n.localize("NAME.SS"):
            moneyTypeIndex.ss = m;
            break;
          case game.i18n.localize("NAME.BP"):
            moneyTypeIndex.bp = m;
            break;
        }
      }
      return moneyTypeIndex;
    }
    static throwMoney(moneyValues) {
      let number = moneyValues.gc || 0;
      if ((moneyValues.ss || 0) > number)
        number = moneyValues.ss || 0;
      if ((moneyValues.bp || 0) > number)
        number = moneyValues.bp || 0;
      if (game.dice3d && game.settings.get("wfrp4e", "throwMoney")) {
        new Roll(`${number}dc`).evaluate().then((roll) => {
          game.dice3d.showForRoll(roll);
        });
      }
    }
    static parseMoneyTransactionString(string) {
      const expression = /((\d+)\s?(\p{L}+))/ug;
      let matches = [...string.matchAll(expression)];
      let payRecap = {
        gc: 0,
        ss: 0,
        bp: 0
      };
      let isValid = matches.length;
      for (let match of matches) {
        if (match.length !== 4) {
          isValid = false;
          break;
        }
        switch (match[3].toLowerCase()) {
          case game.i18n.localize("MARKET.Abbrev.GC").toLowerCase():
            payRecap.gc += parseInt(match[2], 10);
            break;
          case game.i18n.localize("MARKET.Abbrev.SS").toLowerCase():
            payRecap.ss += parseInt(match[2], 10);
            break;
          case game.i18n.localize("MARKET.Abbrev.BP").toLowerCase():
            payRecap.bp += parseInt(match[2], 10);
            break;
        }
      }
      if (isValid && payRecap.gc + payRecap.ss + payRecap.bp === 0)
        isValid = false;
      if (isValid && payRecap.gc + payRecap.ss + payRecap.bp === 0)
        isValid = false;
      return isValid ? payRecap : false;
    }
    static generatePayCard(payRequest, player) {
      let parsedPayRequest = this.parseMoneyTransactionString(payRequest);
      if (!parsedPayRequest) {
        let msg = `<h3><b>${game.i18n.localize("MARKET.PayRequest")}</b></h3>`;
        msg += `<p>${game.i18n.localize("MARKET.MoneyTransactionWrongCommand")}</p><p><i>${game.i18n.localize("MARKET.PayCommandExample")}</i></p>`;
        ChatMessage.create(WFRP_Utility.chatDataSetup(msg, "gmroll"));
      } else {
        let cardData = {
          payRequest,
          QtGC: parsedPayRequest.gc,
          QtSS: parsedPayRequest.ss,
          QtBP: parsedPayRequest.bp
        };
        renderTemplate("systems/wfrp4e/templates/chat/market/market-pay.html", cardData).then((html) => {
          let chatData = WFRP_Utility.chatDataSetup(html, "roll", false, player);
          ChatMessage.create(chatData);
        });
      }
    }
    static makeSomeChange(amount, bpRemainder) {
      let gc = 0, ss = 0, bp = 0;
      if (amount >= 0) {
        gc = Math.floor(amount / 240);
        amount = amount % 240;
        ss = Math.floor(amount / 12);
        bp = amount % 12;
        bp = bp + (bpRemainder > 0 ? 1 : 0);
      }
      return { gc, ss, bp };
    }
    static amountToString(amount) {
      let gc = game.i18n.localize("MARKET.Abbrev.GC");
      let ss = game.i18n.localize("MARKET.Abbrev.SS");
      let bp = game.i18n.localize("MARKET.Abbrev.BP");
      return `${amount.gc}${gc} ${amount.ss}${ss} ${amount.bp}${bp}`;
    }
    static splitAmountBetweenAllPlayers(initialAmount, nbOfPlayers) {
      let bpAmount = initialAmount.gc * 240 + initialAmount.ss * 12 + initialAmount.bp;
      let bpRemainder = bpAmount % nbOfPlayers;
      bpAmount = Math.floor(bpAmount / nbOfPlayers);
      let amount = this.makeSomeChange(bpAmount, bpRemainder);
      return amount;
    }
    static generateCreditCard(creditRequest, option = "EACH") {
      let parsedPayRequest = this.parseMoneyTransactionString(creditRequest);
      if (!parsedPayRequest) {
        let msg = `<h3><b>${game.i18n.localize("MARKET.CreditRequest")}</b></h3>`;
        msg += `<p>${game.i18n.localize("MARKET.MoneyTransactionWrongCommand")}</p><p><i>${game.i18n.localize("MARKET.CreditCommandExample")}</i></p>`;
        ChatMessage.create(WFRP_Utility.chatDataSetup(msg, "gmroll"));
      } else {
        let amount;
        let nbActivePlayers = Array.from(game.users).filter((u) => u.role != 4 && u.active).length;
        let forceWhisper;
        let message2;
        if (nbActivePlayers == 0) {
          message2 = game.i18n.localize("MARKET.NoPlayers");
          ChatMessage.create({ content: message2 });
          return;
        } else if (option.toLowerCase() === game.wfrp4e.config.creditOptions.SPLIT.toLowerCase()) {
          amount = this.splitAmountBetweenAllPlayers(parsedPayRequest, nbActivePlayers);
          message2 = game.i18n.format("MARKET.RequestMessageForSplitCredit", {
            activePlayerNumber: nbActivePlayers,
            initialAmount: this.amountToString(parsedPayRequest)
          });
        } else if (option.toLowerCase() === game.wfrp4e.config.creditOptions.EACH.toLowerCase()) {
          amount = parsedPayRequest;
          message2 = game.i18n.format("MARKET.RequestMessageForEachCredit", {
            activePlayerNumber: nbActivePlayers,
            initialAmount: this.amountToString(parsedPayRequest)
          });
        } else {
          amount = parsedPayRequest;
          let pname = option.trim().toLowerCase();
          let player = game.users.players.filter((p) => p.name.toLowerCase() == pname);
          if (player[0]) {
            forceWhisper = player[0].name;
            message2 = game.i18n.format("MARKET.CreditToUser", {
              userName: player[0].name,
              initialAmount: this.amountToString(parsedPayRequest)
            });
          } else {
            message2 = game.i18n.localize("MARKET.NoMatchingPlayer");
            ChatMessage.create({ content: message2 });
            return;
          }
        }
        let cardData = {
          digestMessage: message2,
          amount: this.amountToString(amount),
          QtGC: amount.gc,
          QtSS: amount.ss,
          QtBP: amount.bp
        };
        renderTemplate("systems/wfrp4e/templates/chat/market/market-credit.html", cardData).then((html) => {
          let chatData = WFRP_Utility.chatDataSetup(html, "roll", false, forceWhisper);
          ChatMessage.create(chatData);
        });
      }
    }
  };

  // modules/system/effect-wfrp4e.js
  var EffectWfrp4e = class extends ActiveEffect {
    constructor(data, context) {
      if (data.id) {
        setProperty(data, "flags.core.statusId", data.id);
        delete data.id;
      }
      super(data, context);
    }
    prepareDialogChoice() {
      let effect = this.toObject();
      return this._handleDialogChoiceScript.bind(effect)();
    }
    _handleDialogChoiceScript() {
      for (let mod in this.flags.wfrp4e.effectData) {
        try {
          if (mod != "description")
            this.flags.wfrp4e.effectData[mod] = (0, eval)(this.flags.wfrp4e.effectData[mod]);
        } catch (e) {
          console.error("Error parsing dialogChoice effect");
          this.flags.wfrp4e.effectData[mod] = "";
        }
      }
      if (this.flags.wfrp4e.script)
        new Function(this.flags.wfrp4e.script).bind(this)();
      return this.flags.wfrp4e.effectData;
    }
    get item() {
      if (this.origin && this.parent.documentName == "Actor") {
        let origin = this.origin.split(".");
        let id = origin[origin.length - 1];
        return this.parent.items.get(id);
      } else if (this.parent.documentName == "Item")
        return this.parent;
    }
    get sourceName() {
      let sourceName = super.sourceName;
      if (sourceName == "Unknown") {
        let sourceItem = this.item;
        if (sourceItem)
          sourceName = sourceItem.name;
        if (sourceItem && sourceItem.type == "disease" && !game.user.isGM)
          sourceName = "???";
      }
      return sourceName;
    }
    get isCondition() {
      return CONFIG.statusEffects.map((i) => i.id).includes(this.getFlag("core", "statusId"));
    }
    get conditionId() {
      return this.getFlag("core", "statusId");
    }
    get isNumberedCondition() {
      return Number.isNumeric(this.conditionValue);
    }
    get show() {
      if (game.user.isGM || !this.getFlag("wfrp4e", "hide"))
        return true;
      else
        return false;
    }
    get isTargeted() {
      return this.application == "apply" || this.trigger == "invoke";
    }
    get application() {
      return getProperty(this, "flags.wfrp4e.effectApplication");
    }
    get trigger() {
      return getProperty(this, "flags.wfrp4e.effectTrigger");
    }
    get conditionTrigger() {
      return getProperty(this, "flags.wfrp4e.trigger");
    }
    get script() {
      return getProperty(this, "flags.wfrp4e.script");
    }
    get statusId() {
      return getProperty(this, "flags.core.statusId");
    }
    get conditionValue() {
      return getProperty(this, "flags.wfrp4e.value");
    }
    get reduceQuantity() {
      return this.parent?.type == "trapping" && getProperty(this, "flags.wfrp4e.reduceQuantity");
    }
    reduceItemQuantity() {
      if (this.reduceQuantity && this.item) {
        if (this.item.quantity.value > 0)
          this.item.update({ "system.quantity.value": this.item.quantity.value - 1 });
        else
          throw ui.notifications.error(game.i18n.localize("EFFECT.QuantityError"));
      }
    }
    get displayLabel() {
      if (this.count > 1)
        return this.label + ` (${this.count})`;
      else
        return this.label;
    }
    get specifier() {
      return this.label.substring(this.label.indexOf("(") + 1, this.label.indexOf(")"));
    }
  };

  // modules/apps/name-gen.js
  var NameGenWfrp = class {
    static _loadNames() {
      WFRP_Utility.log("Loading Names...", true);
      fetch("systems/wfrp4e/names/human_surnames.txt").then((r) => r.text()).then(async (nameText) => {
        this.surnames = [];
        nameText.split("\n").forEach((nameGroup) => this.surnames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/human_surnames_prefix.txt").then((r) => r.text()).then(async (nameText) => {
        this.surnamePrefixes = [];
        nameText.split("\n").forEach((nameGroup) => this.surnamePrefixes.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/human_surnames_suffix.txt").then((r) => r.text()).then(async (nameText) => {
        this.surnameSuffixes = [];
        nameText.split("\n").forEach((nameGroup) => this.surnameSuffixes.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/male_human_forenames.txt").then((r) => r.text()).then(async (nameText) => {
        this.human_male_Forenames = [];
        nameText.split("\n").forEach((nameGroup) => this.human_male_Forenames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/female_human_forenames.txt").then((r) => r.text()).then(async (nameText) => {
        this.human_female_Forenames = [];
        nameText.split("\n").forEach((nameGroup) => this.human_female_Forenames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/male_dwarf_forenames.txt").then((r) => r.text()).then(async (nameText) => {
        this.dwarf_male_Forenames = [];
        nameText.split("\n").forEach((nameGroup) => this.dwarf_male_Forenames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/female_dwarf_forenames.txt").then((r) => r.text()).then(async (nameText) => {
        this.dwarf_female_Forenames = [];
        nameText.split("\n").forEach((nameGroup) => this.dwarf_female_Forenames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_forenames.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_Forenames = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_Forenames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_surnames.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_surnames = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_surnames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_start.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_start = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_start.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_connectors.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_connectors = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_connectors.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/male_elf_element.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_male_element = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_male_element.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/female_elf_element.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_female_element = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_female_element.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_wood_end.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_wood_end = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_wood_end.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/elf_high_end.txt").then((r) => r.text()).then(async (nameText) => {
        this.elf_high_end = [];
        nameText.split("\n").forEach((nameGroup) => this.elf_high_end.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/halfling_start.txt").then((r) => r.text()).then(async (nameText) => {
        this.halfling_start = [];
        nameText.split("\n").forEach((nameGroup) => this.halfling_start.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/male_halfling_element.txt").then((r) => r.text()).then(async (nameText) => {
        this.male_halfling_element = [];
        nameText.split("\n").forEach((nameGroup) => this.male_halfling_element.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/female_halfling_element.txt").then((r) => r.text()).then(async (nameText) => {
        this.female_halfling_element = [];
        nameText.split("\n").forEach((nameGroup) => this.female_halfling_element.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/halfling_surnames.txt").then((r) => r.text()).then(async (nameText) => {
        this.halfling_surnames = [];
        nameText.split("\n").forEach((nameGroup) => this.halfling_surnames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
      fetch("systems/wfrp4e/names/halfling_nicknames.txt").then((r) => r.text()).then(async (nameText) => {
        this.halfling_nicknames = [];
        nameText.split("\n").forEach((nameGroup) => this.halfling_nicknames.push(nameGroup.split(",").map(function(item) {
          return item.trim();
        })));
      });
    }
    static generateName(options = { species: "human" }) {
      if (!options.species) {
        options.species = "human";
      }
      if (options.species)
        options.species = options.species.toLowerCase();
      if (options.gender)
        options.gender = options.gender.toLowerCase();
      else
        options.gender = Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1 ? "male" : "female";
      return this[options.species].forename(options.gender) + " " + this[options.species].surname(options.gender);
    }
    static evaluateNamePartial(namePartial) {
      var options = Array.from(namePartial.matchAll(/\((.+?)\)/g));
      for (let option of options) {
        if (Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1) {
          namePartial = namePartial.replace(option[0], this.evaluateChoices(option[1]));
        } else {
          namePartial = namePartial.replace(option[0], "");
        }
      }
      return this.evaluateChoices(namePartial);
    }
    static evaluateChoices(choiceString) {
      if (!choiceString)
        return choiceString;
      let choices = Array.from(choiceString.matchAll(/(\w+)[\/]*/g));
      let choice = Math.floor(CONFIG.Dice.randomUniform() * choices.length);
      return choices[choice][1];
    }
    static RollArray(arrayName) {
      let elements = this[arrayName];
      let size = elements.length;
      let roll = Math.floor(CONFIG.Dice.randomUniform() * size);
      return elements[roll][0];
    }
  };
  __publicField(NameGenWfrp, "human", {
    forename(gender = "male") {
      let names = game.wfrp4e.names[`human_${gender}_Forenames`];
      let size = names.length;
      let roll = Math.floor(CONFIG.Dice.randomUniform() * size);
      let nameGroup = names[roll];
      let base = nameGroup[0];
      let option;
      roll = Math.floor(CONFIG.Dice.randomUniform() * nameGroup.length);
      if (roll != 0)
        option = nameGroup[roll].substr(1);
      return game.wfrp4e.names.evaluateNamePartial(base) + game.wfrp4e.names.evaluateNamePartial(option || "");
    },
    surname() {
      if (Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1) {
        let size = game.wfrp4e.names.surnames.length;
        let roll = Math.floor(CONFIG.Dice.randomUniform() * size);
        let nameGroup = game.wfrp4e.names.surnames[roll];
        let base = nameGroup[0];
        let option;
        roll = Math.floor(CONFIG.Dice.randomUniform() * nameGroup.length);
        if (roll != 0)
          option = nameGroup[roll].substr(1);
        return game.wfrp4e.names.evaluateNamePartial(base) + game.wfrp4e.names.evaluateNamePartial(option || "");
      } else {
        let prefixSize = game.wfrp4e.names.surnamePrefixes.length;
        let suffixSize = game.wfrp4e.names.surnameSuffixes.length;
        let prefixChoice = game.wfrp4e.names.surnamePrefixes[Math.floor(CONFIG.Dice.randomUniform() * prefixSize)][0];
        let suffixChoice = game.wfrp4e.names.surnameSuffixes[Math.floor(CONFIG.Dice.randomUniform() * suffixSize)][0];
        return game.wfrp4e.names.evaluateNamePartial(prefixChoice) + game.wfrp4e.names.evaluateNamePartial(suffixChoice);
      }
    }
  });
  __publicField(NameGenWfrp, "dwarf", {
    forename(gender = "male") {
      let names = game.wfrp4e.names[`dwarf_${gender}_Forenames`];
      let size = names.length;
      let roll = Math.floor(CONFIG.Dice.randomUniform() * size);
      let nameGroup = names[roll];
      let base = nameGroup[0];
      let option;
      roll = Math.floor(CONFIG.Dice.randomUniform() * nameGroup.length);
      if (roll != 0)
        option = nameGroup[roll].substr(1);
      return game.wfrp4e.names.evaluateNamePartial(base) + game.wfrp4e.names.evaluateNamePartial(option || "");
    },
    surname(gender = "male") {
      let base = this.forename(gender);
      let suffix = "";
      if (gender == "male") {
        suffix = Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1 ? "snev" : "sson";
      } else {
        suffix = Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1 ? "sniz" : "sdottir";
      }
      return base + suffix;
    }
  });
  __publicField(NameGenWfrp, "helf", {
    forename(gender = "male", type = "helf") {
      let source = Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1 ? "forename" : "generate";
      if (source == "forename") {
        let names = game.wfrp4e.names[`elf_Forenames`];
        let size = names.length;
        let roll = Math.floor(CONFIG.Dice.randomUniform() * size);
        return names[roll][0];
      } else {
        let useConnector = false, useElement = false, useEnd = false;
        switch (Math.floor(CONFIG.Dice.randomUniform() * 4 + 1) == 1) {
          case 1:
            useConnector = true;
            useElement = true;
            break;
          case 2:
            useElement = true;
            break;
          case 3:
            useConnector = true;
            useEnd = true;
            break;
          case 4:
            useEnd = true;
        }
        let start = game.wfrp4e.names.RollArray("elf_start");
        let connector = useConnector ? game.wfrp4e.names.RollArray("elf_connectors") : "";
        let element = useElement ? game.wfrp4e.names.RollArray(`elf_${gender}_element`) : "";
        let elfType = type.includes("h") ? "high" : "wood";
        let end = useEnd ? game.wfrp4e.names.RollArray(`elf_${elfType}_end`) : "";
        return start + connector + element + end;
      }
    },
    surname() {
      return game.wfrp4e.names.RollArray("elf_surnames");
    }
  });
  __publicField(NameGenWfrp, "welf", {
    forename(gender = "male", type = "welf") {
      return game.wfrp4e.names.helf.forename(gender, type);
    },
    surname() {
      return game.wfrp4e.names.RollArray("elf_surnames");
    }
  });
  __publicField(NameGenWfrp, "halfling", {
    forename(gender = "male") {
      let nickname = Math.ceil(CONFIG.Dice.randomUniform() * 2) == 1 ? `(${game.wfrp4e.names.RollArray("halfling_nicknames")})` : "";
      return `${game.wfrp4e.names.RollArray("halfling_start")}${game.wfrp4e.names.RollArray(`${gender}_halfling_element`)} ${nickname}`;
    },
    surname() {
      return game.wfrp4e.names.RollArray("halfling_surnames");
    }
  });

  // modules/system/rolls/test-wfrp4e.js
  var TestWFRP = class {
    constructor(data, actor) {
      if (!data)
        data = {};
      this.data = {
        preData: {
          title: data.title,
          SL: data.SL,
          roll: data.roll,
          target: data.target,
          rollClass: this.constructor.name,
          testModifier: data.testModifier || 0,
          testDifficulty: (typeof data.testDifficulty == "string" ? game.wfrp4e.config.difficultyModifiers[data.testDifficulty] : data.testDifficulty) || 0,
          successBonus: data.successBonus || 0,
          slBonus: data.slBonus || 0,
          hitLocation: data.hitLocation != "none" && data.hitLocation || false,
          item: data.item,
          diceDamage: data.diceDamage,
          options: data.options || {},
          other: data.other || [],
          canReverse: data.canReverse || false,
          postOpposedModifiers: data.postOpposedModifiers || { modifiers: 0, SL: 0 },
          additionalDamage: data.additionalDamage || 0,
          selectedHitLocation: typeof data.hitLocation == "string" ? data.hitLocation : "",
          hitLocationTable: data.hitLocationTable
        },
        result: {
          roll: data.roll,
          description: "",
          tooltips: {}
        },
        context: {
          rollMode: data.rollMode,
          reroll: false,
          edited: false,
          speaker: data.speaker,
          postFunction: data.postFunction,
          targets: data.targets,
          cardOptions: data.cardOptions,
          unopposed: data.unopposed,
          defending: data.defending,
          messageId: data.messageId,
          opposedMessageIds: data.opposedMessageIds || [],
          fortuneUsedReroll: data.fortuneUsedReroll,
          fortuneUsedAddSL: data.fortuneUsedAddSL
        }
      };
      if (this.context.speaker && this.actor.isOpposing && this.context.targets.length) {
        ui.notifications.notify(game.i18n.localize("TargetingCancelled"));
        this.context.targets = [];
      }
      if (!this.context.speaker && actor)
        this.context.speaker = actor.speakerData();
    }
    computeTargetNumber() {
      if (this.preData.target)
        this.data.result.target = this.preData.target;
      else
        this.data.result.target += this.targetModifiers;
    }
    runPreEffects() {
      this.actor.runEffects("preRollTest", { test: this, cardOptions: this.context.cardOptions });
    }
    runPostEffects() {
      this.actor.runEffects("rollTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollTest", this, this.context.cardOptions);
    }
    async roll() {
      this.runPreEffects();
      this.reset();
      if (!this.preData.item)
        throw new Error(game.i18n.localize("ERROR.Property"));
      if (!this.context.speaker)
        throw new Error(game.i18n.localize("ERROR.Speaker"));
      await this.rollDices();
      await this.computeResult();
      this.runPostEffects();
      this.postTest();
      if (!this.context.unopposed) {
        await this.renderRollCard();
        this.handleOpposed();
      }
      WFRP_Utility.log("Rolled Test: ", this);
      return this;
    }
    async reroll() {
      this.context.previousResult = this.result;
      this.context.reroll = true;
      delete this.result.roll;
      delete this.result.hitloc;
      delete this.preData.hitloc;
      delete this.preData.roll;
      delete this.preData.SL;
      this.context.messageId = "";
      this.roll();
    }
    async addSL(SL) {
      this.context.previousResult = duplicate(this.result);
      this.preData.SL = Math.trunc(this.result.SL) + SL;
      this.preData.slBonus = 0;
      this.preData.successBonus = 0;
      this.preData.roll = Math.trunc(this.result.roll);
      if (this.preData.hitLocation)
        this.preData.hitloc = this.result.hitloc.roll;
      this.roll();
    }
    async computeResult() {
      this.computeTargetNumber();
      let successBonus = this.preData.successBonus;
      let slBonus = this.preData.slBonus + this.preData.postOpposedModifiers.SL;
      let target = this.result.target;
      let outcome;
      let description = "";
      if (this.preData.canReverse) {
        let reverseRoll = this.result.roll.toString();
        if (this.result.roll >= 96 || this.result.roll > target && this.result.roll > 5) {
          if (reverseRoll.length == 1)
            reverseRoll = reverseRoll[0] + "0";
          else {
            reverseRoll = reverseRoll[1] + reverseRoll[0];
          }
          reverseRoll = Number(reverseRoll);
          if (reverseRoll <= 5 || reverseRoll <= target) {
            this.result.roll = reverseRoll;
            this.preData.other.push(game.i18n.localize("ROLL.Reverse"));
          }
        }
      }
      let SL;
      if (this.preData.SL == 0)
        SL = this.preData.SL;
      else
        SL = this.preData.SL || Math.floor(target / 10) - Math.floor(this.result.roll / 10) + slBonus;
      if (this.result.roll >= 96 || this.result.roll > target && this.result.roll > 5) {
        description = game.i18n.localize("ROLL.Failure");
        outcome = "failure";
        if (this.result.roll >= 96 && SL > -1)
          SL = -1;
        switch (Math.abs(Number(SL))) {
          case 6:
            description = game.i18n.localize("ROLL.AstoundingFailure");
            break;
          case 5:
          case 4:
            description = game.i18n.localize("ROLL.ImpressiveFailure");
            break;
          case 3:
          case 2:
            break;
          case 1:
          case 0:
            description = game.i18n.localize("ROLL.MarginalFailure");
            break;
          default:
            if (Math.abs(Number(SL)) > 6)
              description = game.i18n.localize("ROLL.AstoundingFailure");
        }
        if (SL > 0) {
          description = game.i18n.localize("ROLL.MarginalFailure");
          SL = "+" + SL.toString();
        }
        if (SL == 0)
          SL = "-" + SL.toString();
      } else if (this.result.roll <= 5 || this.result.roll <= target) {
        description = game.i18n.localize("ROLL.Success");
        outcome = "success";
        if (game.settings.get("wfrp4e", "fastSL")) {
          let rollString = this.result.roll.toString();
          if (rollString.length == 2)
            SL = Number(rollString.split("")[0]);
          else
            SL = 0;
          SL += slBonus;
          if (Number.isNumeric(this.preData.SL)) {
            SL = this.preData.SL;
          }
        }
        SL += successBonus;
        if (this.result.roll <= 5 && SL < 1 && !this.context.unopposed)
          SL = 1;
        if (!game.settings.get("wfrp4e", "mooRangedDamage")) {
          if (this.options.sizeModifier) {
            let unmodifiedTarget = target - this.options.sizeModifier;
            if (this.result.roll > unmodifiedTarget) {
              SL = 0;
              this.result.other.push(game.i18n.localize("ROLL.SizeCausedSuccess"));
            }
          }
        }
        switch (Math.abs(Number(SL))) {
          case 6:
            description = game.i18n.localize("ROLL.AstoundingSuccess");
            break;
          case 5:
          case 4:
            description = game.i18n.localize("ROLL.ImpressiveSuccess");
            break;
          case 3:
          case 2:
            break;
          case 1:
          case 0:
            description = game.i18n.localize("ROLL.MarginalSuccess");
            break;
          default:
            if (Math.abs(Number(SL)) > 6)
              description = game.i18n.localize("ROLL.AstoundingSuccess");
        }
        if (SL < 0)
          description = game.i18n.localize("ROLL.MarginalSuccess");
        if (game.settings.get("wfrp4e", "testAbove100")) {
          if (target > 100) {
            let addSL = Math.floor((target - 100) / 10);
            SL += addSL;
          }
        }
        if (SL >= 0)
          SL = "+" + SL.toString();
      }
      this.result.target = target;
      this.result.SL = SL;
      this.result.description = description;
      this.result.outcome = outcome;
      if (this.options.context) {
        if (this.options.context.general)
          this.result.other = this.result.other.concat(this.options.context.general);
        if (this.result.outcome == "failure" && this.options.context.failure)
          this.result.other = this.result.other.concat(this.options.context.failure);
        if (this.result.outcome == "success" && this.options.context.success)
          this.result.other = this.result.other.concat(this.options.context.success);
      }
      if (this.preData.hitLocation) {
        if (this.preData.selectedHitLocation != "roll") {
          this.result.hitloc = game.wfrp4e.tables.hitLocKeyToResult(this.preData.selectedHitLocation);
        }
        if (this.preData.hitloc) {
          if (Number.isNumeric(this.preData.hitloc))
            this.result.hitloc = await game.wfrp4e.tables.rollTable("hitloc", { lookup: this.preData.hitloc, hideDSN: true });
        }
        if (!this.result.hitloc)
          this.result.hitloc = await game.wfrp4e.tables.rollTable("hitloc", { hideDSN: true });
        this.result.hitloc.roll = (0, eval)(this.result.hitloc.roll);
        this.result.hitloc.description = game.i18n.localize(this.result.hitloc.description);
        if (this.preData.selectedHitLocation && this.preData.selectedHitLocation != "roll") {
          this.result.hitloc.description = this.preData.hitLocationTable[this.preData.selectedHitLocation] + ` (${game.i18n.localize("ROLL.CalledShot")})`;
        }
      }
      let roll = this.result.roll;
      if (this.preData.hitLocation) {
        if (roll > target && roll % 11 == 0 || roll == 100 || roll == 99) {
          this.result.color_red = true;
          this.result.fumble = game.i18n.localize("Fumble");
        } else if (roll <= target && roll % 11 == 0) {
          this.result.color_green = true;
          this.result.critical = game.i18n.localize("Critical");
        }
      }
      if (game.settings.get("wfrp4e", "criticalsFumblesOnAllTests") && !this.preData.hitLocation) {
        if (roll > target && roll % 11 == 0 || roll == 100 || roll == 99) {
          this.result.color_red = true;
          this.result.description = game.i18n.localize("ROLL.AstoundingFailure");
        } else if (roll <= target && roll % 11 == 0) {
          this.result.color_green = true;
          this.result.description = game.i18n.localize("ROLL.AstoundingSuccess");
        }
      }
      return this.result;
    }
    async postTest() {
      if (game.settings.get("wfrp4e", "mooCriticalMitigation") && this.result.critical) {
        game.wfrp4e.utility.logHomebrew("mooCriticalMitigation");
        try {
          let target = this.targets[0];
          if (target) {
            let AP = target.status.armour[this.result.hitloc.result].value;
            if (AP) {
              this.result.critModifier = -10 * AP;
              this.result.critical += ` (${this.result.critModifier})`;
              this.result.other.push(`Critical Mitigation: Damage AP on target's ${this.result.hitloc.description}`);
            }
          }
        } catch (e) {
          game.wfrp4e.utility.log("Error appyling homebrew mooCriticalMitigation: " + e);
        }
      }
      if (this.options.corruption) {
        await this.actor.handleCorruptionResult(this);
      }
      if (this.options.mutate) {
        await this.actor.handleMutationResult(this);
      }
      if (this.options.extended) {
        await this.actor.handleExtendedTest(this);
      }
      if (this.options.income) {
        await this.actor.handleIncomeTest(this);
      }
      if (this.options.rest) {
        this.result.woundsHealed = Math.max(Math.trunc(this.result.SL) + this.options.tb, 0);
        this.result.other.push(`${this.result.woundsHealed} ${game.i18n.localize("Wounds Healed")}`);
      }
    }
    async handleSoundContext(cardOptions) {
      try {
        let contextAudio = await WFRP_Audio.MatchContextAudio(WFRP_Audio.FindContext(this));
        cardOptions.sound = contextAudio.file || cardOptions.sound;
      } catch {
      }
    }
    async handleOpposed() {
      if (this.actor.isOpposing || this.context.defending) {
        let opposeMessage;
        if (this.context.defending) {
          opposeMessage = this.opposedMessages[0];
        } else {
          this.context.defending = true;
          opposeMessage = game.messages.get(this.actor.flags.oppose.opposeMessageId);
          this.context.opposedMessageIds.push(opposeMessage.id);
        }
        let oppose = opposeMessage.getOppose();
        oppose.setDefender(this.message);
        oppose.computeOpposeResult();
        this.actor.clearOpposed();
        this.updateMessageFlags();
      } else {
        if (this.opposedMessages.length) {
          for (let message2 of this.opposedMessages) {
            let oppose = message2.getOppose();
            await oppose.setAttacker(this.message);
            if (oppose.defenderTest)
              oppose.computeOpposeResult();
          }
        } else {
          for (let token of this.context.targets.map((t) => WFRP_Utility.getToken(t))) {
            await this.createOpposedMessage(token);
          }
        }
      }
    }
    static recreate(data) {
      let test = new game.wfrp4e.rolls[data.preData.rollClass]();
      test.data = data;
      test.computeTargetNumber();
      return test;
    }
    async rollDices() {
      if (isNaN(this.preData.roll)) {
        let roll = await new Roll("1d100").roll({ async: true });
        await this._showDiceSoNice(roll, this.context.rollMode || "roll", this.context.speaker);
        this.result.roll = roll.total;
      } else
        this.result.roll = this.preData.roll;
    }
    reset() {
      this.data.result = mergeObject({
        roll: void 0,
        description: "",
        tooltips: {}
      }, this.preData);
    }
    async renderRollCard({ newMessage = false } = {}) {
      let chatOptions = this.context.cardOptions;
      await this.handleSoundContext(chatOptions);
      if (game.settings.get("wfrp4e", "manualChatCards") && !this.message)
        this.result.roll = this.result.SL = null;
      if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active && chatOptions.sound?.includes("dice"))
        chatOptions.sound = void 0;
      this.result.other = this.preData.other.join("<br>");
      let chatData = {
        title: chatOptions.title,
        test: this,
        hideData: game.user.isGM
      };
      if (this.context.targets.length) {
        chatData.title += ` - ${game.i18n.localize("Opposed")}`;
      }
      ChatMessage.applyRollMode(chatOptions, chatOptions.rollMode);
      let html = await renderTemplate(chatOptions.template, chatData);
      if (newMessage || !this.message) {
        if (game.settings.get("wfrp4e", "manualChatCards")) {
          let blank = $(html);
          let elementsToToggle = blank.find(".display-toggle");
          for (let elem of elementsToToggle) {
            if (elem.style.display == "none")
              elem.style.display = "";
            else
              elem.style.display = "none";
          }
          html = blank.html();
        }
        chatOptions["content"] = html;
        if (chatOptions.sound)
          WFRP_Utility.log(`Playing Sound: ${chatOptions.sound}`);
        let message2 = await ChatMessage.create(duplicate(chatOptions));
        this.context.messageId = message2.id;
        await this.updateMessageFlags();
      } else {
        chatOptions["content"] = html;
        if (game.user.isGM || this.message.isAuthor) {
          await this.message.update(chatOptions);
        } else
          game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: this.message.id, updateData: chatOptions } });
        await this.updateMessageFlags();
      }
    }
    updateMessageFlags(updateData = {}) {
      let data = mergeObject(this.data, updateData, { overwrite: true });
      let update = { "flags.testData": data };
      if (this.message && game.user.isGM)
        return this.message.update(update);
      else if (this.message) {
        this.message.flags.testData = data;
        game.socket.emit("system.wfrp4e", { type: "updateMsg", payload: { id: this.message.id, updateData: update } });
      }
    }
    async createOpposedMessage(token) {
      let oppose = new OpposedWFRP();
      oppose.setAttacker(this.message);
      let opposeMessageId = await oppose.startOppose(token);
      this.context.opposedMessageIds.push(opposeMessageId);
      this.updateMessageFlags();
    }
    async _showDiceSoNice(roll, rollMode, speaker) {
      if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active) {
        if (game.settings.get("dice-so-nice", "hideNpcRolls")) {
          let actorType = null;
          if (speaker.actor)
            actorType = game.actors.get(speaker.actor).type;
          else if (speaker.token && speaker.scene)
            actorType = game.scenes.get(speaker.scene).tokens.get(speaker.token).actor.type;
          if (actorType != "character")
            return;
        }
        let whisper = null;
        let blind = false;
        let sync = true;
        switch (rollMode) {
          case "blindroll":
            blind = true;
          case "gmroll":
            let gmList = game.users.filter((user) => user.isGM);
            let gmIDList = [];
            gmList.forEach((gm) => gmIDList.push(gm.id));
            whisper = gmIDList;
            break;
          case "selfroll":
            sync = false;
            break;
          case "roll":
            let userList = game.users.filter((user) => user.active);
            let userIDList = [];
            userList.forEach((user) => userIDList.push(user.id));
            whisper = userIDList;
            break;
        }
        await game.dice3d.showForRoll(roll, game.user, sync, whisper, blind);
      }
    }
    async _overcast(choice) {
      let overcastData = this.result.overcast;
      if (!overcastData.available)
        return overcastData;
      if (typeof overcastData.usage[choice].initial != "number")
        return overcastData;
      switch (choice) {
        case "range":
          overcastData.usage[choice].current += overcastData.usage[choice].initial;
          break;
        case "target":
          overcastData.usage[choice].current += overcastData.usage[choice].initial;
          break;
        case "duration":
          overcastData.usage[choice].current += overcastData.usage[choice].initial;
          break;
        case "other":
          if (overcastData.valuePerOvercast.type == "value")
            overcastData.usage[choice].current += overcastData.valuePerOvercast.value;
          else if (overcastData.valuePerOvercast.type == "SL")
            overcastData.usage[choice].current += parseInt(this.result.SL) + (parseInt(this.item.computeSpellPrayerFormula(void 0, false, overcastData.valuePerOvercast.additional)) || 0);
          else if (overcastData.valuePerOvercast.type == "characteristic")
            overcastData.usage[choice].current += overcastData.usage[choice].increment || 0;
          break;
      }
      overcastData.usage[choice].count++;
      let sum = 0;
      for (let overcastType in overcastData.usage)
        if (overcastData.usage[overcastType].count)
          sum += overcastData.usage[overcastType].count;
      overcastData.available = overcastData.total - sum;
      if (game.settings.get("wfrp4e", "mooOvercasting")) {
        game.wfrp4e.utility.logHomebrew("mooOvercasting");
        this.result.SL = `+${this.result.SL - 2}`;
        await this._calculateDamage();
      }
      this.renderRollCard();
    }
    async _overcastReset() {
      let overcastData = this.result.overcast;
      for (let overcastType in overcastData.usage) {
        if (overcastData.usage[overcastType].count) {
          overcastData.usage[overcastType].count = 0;
          overcastData.usage[overcastType].current = overcastData.usage[overcastType].initial;
        }
      }
      if (game.settings.get("wfrp4e", "mooOvercasting")) {
        game.wfrp4e.utility.logHomebrew("mooOvercasting");
        this.result.SL = `+${Number(this.result.SL) + 2 * (overcastData.total - overcastData.available)}`;
        await this._calculateDamage();
      }
      overcastData.available = overcastData.total;
      this.renderRollCard();
    }
    _handleMiscasts(miscastCounter) {
      if (this.preData.unofficialGrimoire) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        let controlIngredient = this.preData.unofficialGrimoire.ingredientMode == "control";
        if (miscastCounter == 1) {
          if (this.hasIngredient && controlIngredient)
            this.result.nullminormis = game.i18n.localize("ROLL.MinorMis");
          else {
            this.result.minormis = game.i18n.localize("ROLL.MinorMis");
          }
        } else if (miscastCounter == 2) {
          if (this.hasIngredient && controlIngredient) {
            this.result.nullmajormis = game.i18n.localize("ROLL.MajorMis");
            this.result.minormis = game.i18n.localize("ROLL.MinorMis");
          } else {
            this.result.majormis = game.i18n.localize("ROLL.MajorMis");
          }
        } else if (miscastCounter == 3) {
          if (this.hasIngredient && controlIngredient) {
            this.result.nullcatastrophicmis = game.i18n.localize("ROLL.CatastrophicMis");
            this.result.majormis = game.i18n.localize("ROLL.MajorMis");
          } else
            this.result.catastrophicmis = game.i18n.localize("ROLL.CatastrophicMis");
        } else if (miscastCounter > 3) {
          this.result.catastrophicmis = game.i18n.localize("ROLL.CatastrophicMis");
        }
      } else {
        if (miscastCounter == 1) {
          if (this.hasIngredient)
            this.result.nullminormis = game.i18n.localize("ROLL.MinorMis");
          else {
            this.result.minormis = game.i18n.localize("ROLL.MinorMis");
          }
        } else if (miscastCounter == 2) {
          if (this.hasIngredient) {
            this.result.nullmajormis = game.i18n.localize("ROLL.MajorMis");
            this.result.minormis = game.i18n.localize("ROLL.MinorMis");
          } else {
            this.result.majormis = game.i18n.localize("ROLL.MajorMis");
          }
        } else if (!game.settings.get("wfrp4e", "mooCatastrophicMiscasts") && miscastCounter >= 3)
          this.result.majormis = game.i18n.localize("ROLL.MajorMis");
        else if (game.settings.get("wfrp4e", "mooCatastrophicMiscasts") && miscastCounter >= 3) {
          game.wfrp4e.utility.logHomebrew("mooCatastrophicMiscasts");
          if (this.hasIngredient) {
            this.result.nullcatastrophicmis = game.i18n.localize("ROLL.CatastrophicMis");
            this.result.majormis = game.i18n.localize("ROLL.MajorMis");
          } else {
            this.result.catastrophicmis = game.i18n.localize("ROLL.CatastrophicMis");
          }
        }
      }
    }
    get message() {
      return game.messages.get(this.context.messageId);
    }
    get isOpposed() {
      return this.context.opposedMessageIds.length > 0;
    }
    get opposedMessages() {
      return this.context.opposedMessageIds.map((id) => game.messages.get(id));
    }
    get fortuneUsed() {
      return { reroll: this.context.fortuneUsedReroll, SL: this.context.fortuneUsedAddSL };
    }
    get targetModifiers() {
      return this.preData.testModifier + this.preData.testDifficulty + (this.preData.postOpposedModifiers.target || 0);
    }
    get succeeded() {
      return this.result.outcome == "success";
    }
    get isCritical() {
      return this.result.critical;
    }
    get isFumble() {
      return this.result.fumble;
    }
    get useMount() {
      return this.item.attackType == "melee" && this.actor.isMounted && this.actor.mount && this.result.charging;
    }
    get effects() {
      let effects = [];
      if (this.item?.effects)
        effects = this.item.effects.filter((e) => e.application == "apply");
      if (this.item?.ammo?.effects)
        effects = this.item.ammo.effects.filter((e) => e.application == "apply");
      return effects;
    }
    get target() {
      return this.data.result.target;
    }
    get successBonus() {
      return this.data.preData.successBonus;
    }
    get slBonus() {
      return this.data.preData.slBonus;
    }
    get damage() {
      return this.data.result.damage;
    }
    get hitloc() {
      return this.data.result.hitloc;
    }
    get type() {
      return this.data.type;
    }
    get size() {
      return this.useMount ? this.actor.mount.details.size.value : this.actor.details.size.value;
    }
    get options() {
      return this.data.preData.options;
    }
    get outcome() {
      return this.data.result.outcome;
    }
    get result() {
      return this.data.result;
    }
    get preData() {
      return this.data.preData;
    }
    get context() {
      return this.data.context;
    }
    get actor() {
      return WFRP_Utility.getSpeaker(this.context.speaker);
    }
    get token() {
      return WFRP_Utility.getToken(this.context.speaker);
    }
    get item() {
      if (typeof this.data.preData.item == "string")
        return this.actor.items.get(this.data.preData.item);
      else
        return new CONFIG.Item.documentClass(this.data.preData.item, { parent: this.actor });
    }
    get targets() {
      return this.context.targets.map((i) => WFRP_Utility.getSpeaker(i));
    }
    get doesDamage() {
      return !!this.result.damage || !!this.result.diceDamage || !!this.result.additionalDamage;
    }
    get DamageString() {
      let damageElements = [];
      if (this.result.damage)
        damageElements.push(this.result.damage);
      if (this.result.diceDamage)
        damageElements.push(`<span title=${this.result.diceDamage.formula}>${this.result.diceDamage.value}</span>`);
      return `(${damageElements.join(" + ")} ${game.i18n.localize("Damage")})`;
    }
    get characteristicKey() {
      return this.item.characteristic.key;
    }
  };

  // modules/system/rolls/characteristic-test.js
  var CharacteristicTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.computeTargetNumber();
    }
    computeTargetNumber() {
      this.data.result.target = this.item.value;
      super.computeTargetNumber();
    }
    get item() {
      return this.actor.characteristics[this.data.preData.item];
    }
    get characteristic() {
      return this.item;
    }
    get characteristicKey() {
      return this.preData.item;
    }
  };

  // modules/actor/sheet/actor-sheet.js
  var ActorSheetWfrp4e = class extends ActorSheet {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }];
      options.width = 576;
      return options;
    }
    async _render(force = false, options = {}) {
      this._saveScrollPos();
      await super._render(force, options);
      this._setScrollPos();
      $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
      $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
      $(this._element).find(".configure-token").attr("title", game.i18n.localize("SHEET.Token"));
      $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
      this._refocus(this._element);
    }
    _saveScrollPos() {
      if (this.form === null)
        return;
      const html = $(this.form).parent();
      this.scrollPos = [];
      let lists = $(html.find(".save-scroll"));
      for (let list of lists) {
        this.scrollPos.push($(list).scrollTop());
      }
    }
    _setScrollPos() {
      if (this.scrollPos) {
        const html = $(this.form).parent();
        let lists = $(html.find(".save-scroll"));
        for (let i = 0; i < lists.length; i++) {
          $(lists[i]).scrollTop(this.scrollPos[i]);
        }
      }
    }
    _refocus(html) {
      try {
        let element;
        if (this.saveFocus)
          element = html.find(`input[${this.saveFocus}]`)[0];
        if (element) {
          element.focus();
          element.select();
        }
      } catch (e) {
        WFRP_Utility.log("Could not refocus tabbed element on character sheet");
      }
    }
    async getData() {
      const sheetData = await super.getData();
      sheetData.system = sheetData.data.system;
      sheetData.items = this.constructItemLists(sheetData);
      this.formatArmourSection(sheetData);
      this._addEncumbranceData(sheetData);
      this.filterActiveEffects(sheetData);
      this.addConditionData(sheetData);
      sheetData.attacker = this.actor.attacker;
      if (this.actor.type != "vehicle") {
        sheetData.effects.system = game.wfrp4e.utility.getSystemEffects();
      }
      sheetData.enrichment = await this._handleEnrichment();
      return sheetData;
    }
    async _handleEnrichment() {
      let enrichment = {};
      enrichment["system.details.biography.value"] = await TextEditor.enrichHTML(this.actor.system.details.biography.value, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
      enrichment["system.details.gmnotes.value"] = await TextEditor.enrichHTML(this.actor.system.details.gmnotes.value, { async: true, secrets: this.actor.isOwner, relativeTo: this.actor });
      return expandObject(enrichment);
    }
    constructItemLists(sheetData) {
      let items = {};
      items.skills = {
        basic: sheetData.actor.getItemTypes("skill").filter((i) => i.advanced.value == "bsc" && i.grouped.value == "noSpec"),
        advanced: sheetData.actor.getItemTypes("skill").filter((i) => i.advanced.value == "adv" || i.grouped.value == "isSpec")
      };
      items.careers = sheetData.actor.getItemTypes("career").reverse();
      items.criticals = sheetData.actor.getItemTypes("critical");
      items.diseases = sheetData.actor.getItemTypes("disease");
      items.injuries = sheetData.actor.getItemTypes("injury");
      items.mutations = sheetData.actor.getItemTypes("mutation");
      items.psychologies = sheetData.actor.getItemTypes("psychology");
      items.traits = sheetData.actor.getItemTypes("trait");
      items.extendedTests = sheetData.actor.getItemTypes("extendedTest");
      items.vehicleMods = sheetData.actor.getItemTypes("vehicleMod");
      items.grimoire = {
        petty: sheetData.actor.getItemTypes("spell").filter((i) => i.lore.value == "petty"),
        lore: sheetData.actor.getItemTypes("spell").filter((i) => i.lore.value != "petty" || !i.lore.value)
      };
      items.prayers = {
        blessings: sheetData.actor.getItemTypes("prayer").filter((i) => i.prayerType.value == "blessing"),
        miracles: sheetData.actor.getItemTypes("prayer").filter((i) => i.prayerType.value == "miracle" || !i.prayerType.value)
      };
      items.equipped = {
        weapons: sheetData.actor.getItemTypes("weapon").filter((i) => i.isEquipped),
        armour: sheetData.actor.getItemTypes("armour").filter((i) => i.isEquipped)
      };
      items.inventory = this.constructInventory(sheetData);
      items.talents = this._consolidateTalents();
      this._sortItemLists(items);
      items.skills.basic = items.skills.basic.sort(WFRP_Utility.nameSorter);
      items.skills.advanced = items.skills.advanced.sort(WFRP_Utility.nameSorter);
      return items;
    }
    constructInventory(sheetData) {
      const categories = {
        weapons: {
          label: game.i18n.localize("WFRP4E.TrappingType.Weapon"),
          items: sheetData.actor.getItemTypes("weapon"),
          toggle: true,
          toggleName: game.i18n.localize("Equipped"),
          show: false,
          dataType: "weapon"
        },
        armor: {
          label: game.i18n.localize("WFRP4E.TrappingType.Armour"),
          items: sheetData.actor.getItemTypes("armour"),
          toggle: true,
          toggleName: game.i18n.localize("Worn"),
          show: false,
          dataType: "armour"
        },
        ammunition: {
          label: game.i18n.localize("WFRP4E.TrappingType.Ammunition"),
          items: sheetData.actor.getItemTypes("ammunition"),
          show: false,
          dataType: "ammunition"
        },
        clothingAccessories: {
          label: game.i18n.localize("WFRP4E.TrappingType.ClothingAccessories"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "clothingAccessories"),
          toggle: true,
          toggleName: game.i18n.localize("Worn"),
          show: false,
          dataType: "trapping"
        },
        booksAndDocuments: {
          label: game.i18n.localize("WFRP4E.TrappingType.BooksDocuments"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "booksAndDocuments"),
          show: false,
          dataType: "trapping"
        },
        toolsAndKits: {
          label: game.i18n.localize("WFRP4E.TrappingType.ToolsKits"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "toolsAndKits" || i.trappingType.value == "tradeTools"),
          show: false,
          dataType: "trapping"
        },
        foodAndDrink: {
          label: game.i18n.localize("WFRP4E.TrappingType.FoodDrink"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "foodAndDrink"),
          show: false,
          dataType: "trapping"
        },
        drugsPoisonsHerbsDraughts: {
          label: game.i18n.localize("WFRP4E.TrappingType.DrugsPoisonsHerbsDraughts"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "drugsPoisonsHerbsDraughts"),
          show: false,
          dataType: "trapping"
        },
        misc: {
          label: game.i18n.localize("WFRP4E.TrappingType.Misc"),
          items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "misc" || !i.trappingType.value),
          show: true,
          dataType: "trapping"
        },
        cargo: {
          label: game.i18n.localize("WFRP4E.TrappingType.Cargo"),
          items: sheetData.actor.getItemTypes("cargo"),
          show: false,
          dataType: "cargo"
        }
      };
      const ingredients = {
        label: game.i18n.localize("WFRP4E.TrappingType.Ingredient"),
        items: sheetData.actor.getItemTypes("trapping").filter((i) => i.trappingType.value == "ingredient"),
        show: false,
        dataType: "trapping"
      };
      const money = {
        items: sheetData.actor.getItemTypes("money"),
        total: 0,
        show: true
      };
      const containers = {
        items: sheetData.actor.getItemTypes("container"),
        show: false
      };
      const misc = {};
      let inContainers = [];
      if (sheetData.actor.hasSpells || sheetData.actor.type == "vehicle")
        inContainers = this._filterItemCategory(ingredients, inContainers);
      else
        categories.misc.items = categories.misc.items.concat(ingredients.items);
      for (let itemCategory in categories)
        inContainers = this._filterItemCategory(categories[itemCategory], inContainers);
      inContainers = this._filterItemCategory(money, inContainers);
      inContainers = this._filterItemCategory(containers, inContainers);
      misc.totalShieldDamage = categories["weapons"].items.reduce((prev, current) => prev += current.damageToItem.shield, 0);
      money.total = money.items.reduce((prev, current) => {
        return prev + current.coinValue.value * current.quantity.value;
      }, 0);
      categories.misc.show = true;
      for (var cont of this.actor.getItemTypes("container")) {
        var itemsInside = inContainers.filter((i) => i.location.value == cont.id);
        cont.carrying = itemsInside.filter((i) => i.type != "container");
        cont.packsInside = itemsInside.filter((i) => i.type == "container");
        cont.carries.current = itemsInside.reduce(function(prev, cur) {
          return Number(prev) + Number(cur.encumbrance.value);
        }, 0);
        cont.carries.current = Math.floor(cont.carries.current);
      }
      return {
        categories,
        ingredients,
        money,
        containers,
        misc
      };
    }
    _filterItemCategory(category, itemsInContainers) {
      itemsInContainers = itemsInContainers.concat(category.items.filter((i) => !!i.location?.value));
      category.items = category.items.filter((i) => !i.location?.value);
      category.show = category.items.length > 0;
      return itemsInContainers;
    }
    addConditionData(sheetData) {
      let conditions = duplicate(game.wfrp4e.config.statusEffects).map((e) => new EffectWfrp4e(e));
      let currentConditions = this.actor.conditions;
      delete conditions.splice(conditions.length - 1, 1);
      for (let condition of conditions) {
        let owned = currentConditions.find((e) => e.conditionId == condition.conditionId);
        if (owned) {
          condition.existing = true;
          condition.flags.wfrp4e.value = owned.conditionValue;
        } else if (condition.isNumberedCondition) {
          condition.flags.wfrp4e.value = 0;
        }
      }
      sheetData.effects.conditions = conditions;
    }
    filterActiveEffects(sheetData) {
      sheetData.effects = {};
      sheetData.effects.conditions = [];
      sheetData.effects.temporary = [];
      sheetData.effects.passive = [];
      sheetData.effects.disabled = [];
      sheetData.effects.targeted = [];
      for (let e of this.actor.actorEffects) {
        if (!e.show)
          continue;
        if (e.isCondition)
          sheetData.effects.conditions.push(e);
        else if (e.disabled)
          sheetData.effects.disabled.push(e);
        else if (e.isTemporary)
          sheetData.effects.temporary.push(e);
        else if (e.isTargeted)
          sheetData.effects.targeted.push(e);
        else
          sheetData.effects.passive.push(e);
      }
      sheetData.effects.passive = this._consolidateEffects(sheetData.effects.passive);
      sheetData.effects.temporary = this._consolidateEffects(sheetData.effects.temporary);
      sheetData.effects.disabled = this._consolidateEffects(sheetData.effects.disabled);
    }
    _sortItemLists(items) {
      for (let prop in items) {
        if (Array.isArray(items[prop]))
          items[prop] = items[prop].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        else if (typeof items == "object")
          this._sortItemLists(items[prop]);
      }
    }
    _consolidateEffects(effects) {
      let consolidated = [];
      for (let effect of effects) {
        let existing = consolidated.find((e) => e.label == effect.label);
        if (!existing)
          consolidated.push(effect);
      }
      for (let effect of consolidated) {
        let count = effects.filter((e) => e.label == effect.label).length;
        effect.count = count;
      }
      return consolidated;
    }
    _consolidateTalents() {
      let talents = this.actor.getItemTypes("talent");
      let consolidated = [];
      for (let talent of talents) {
        let existing = consolidated.find((t) => t.name == talent.name);
        if (!existing)
          consolidated.push(talent);
      }
      return consolidated;
    }
    formatArmourSection(sheetData) {
      let AP = sheetData.system.status.armour;
      for (let loc in AP) {
        if (loc == "shield" || loc == "shieldDamage")
          continue;
        let table = game.wfrp4e.tables.findTable(sheetData.system.details.hitLocationTable.value);
        if (table) {
          let result = table.results.find((r) => r.getFlag("wfrp4e", "loc") == loc);
          if (result)
            AP[loc].label = game.i18n.localize(result.text);
          else
            AP[loc].show = false;
        } else if (game.wfrp4e.config.locations[loc]) {
          AP[loc].label = game.i18n.localize(game.wfrp4e.config.locations[loc]);
        }
      }
    }
    _addEncumbranceData(sheetData) {
      if (this.type != "vehicle")
        sheetData.system.status.encumbrance.pct = sheetData.system.status.encumbrance.current / sheetData.system.status.encumbrance.max * 100;
    }
    addMountData(data) {
      try {
        if (!this.actor.mount)
          return;
        data.mount = this.actor.mount.data;
        if (data.mount.system.status.wounds.value == 0)
          this.actor.status.mount.mounted = false;
        if (data.actor.status.mount.isToken)
          data.mount.sceneName = game.scenes.get(data.actor.system.status.mount.tokenData.scene).name;
      } catch (e) {
        console.error(this.actor.name + ": Failed to get mount data: " + e.message);
      }
    }
    modifyWounds(value) {
      let sign = value.split("")[0];
      if (sign === "+" || sign === "-")
        return this.actor.modifyWounds(parseInt(value));
      else
        return this.actor.setWounds(parseInt(value));
    }
    spellDialog(spell, options = {}) {
      if (spell.lore.value == "petty")
        this.actor.setupCast(spell, options).then((setupData) => {
          this.actor.castTest(setupData);
        });
      else {
        renderTemplate("systems/wfrp4e/templates/dialog/cast-channel-dialog.html").then((dlg) => {
          new Dialog({
            title: game.i18n.localize("DIALOG.CastOrChannel"),
            content: dlg,
            buttons: {
              cast: {
                label: game.i18n.localize("Cast"),
                callback: (btn) => {
                  this.actor.setupCast(spell, options).then((setupData) => {
                    this.actor.castTest(setupData);
                  });
                }
              },
              channel: {
                label: game.i18n.localize("Channel"),
                callback: (btn) => {
                  this.actor.setupChannell(spell, options).then((setupData) => {
                    this.actor.channelTest(setupData);
                  });
                }
              }
            },
            default: "cast"
          }).render(true);
        });
      }
    }
    _getSubmitData(updateData = {}) {
      this.actor.overrides = {};
      let data = super._getSubmitData(updateData);
      data = diffObject(flattenObject(this.actor.toObject(false)), data);
      return data;
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".item-dropdown").click(this._onItemSummary.bind(this));
      html.find(".melee-property-quality, .melee-property-flaw, .ranged-property-quality, .ranged-property-flaw, .armour-quality, .armour-flaw").click(this._expandProperty.bind(this));
      html.find(".weapon-range, .weapon-group, .weapon-reach").click(this._expandInfo.bind(this));
      $("input[type=text]").focusin((ev) => {
        $(this).select();
      });
      if (!this.options.editable)
        return;
      html.find("#configure-actor").click((ev) => {
        new game.wfrp4e.apps.ActorSettings(this.actor).render(true);
      });
      html.find(".wounds-value").change((ev) => {
        this.modifyWounds(ev.target.value);
      });
      html.find(".item-edit").click(this._onItemEdit.bind(this));
      html.find(".ch-value").click(this._onCharClick.bind(this));
      html.find(".rest-icon").click(this._onRestClick.bind(this));
      html.find(".ch-edit").change(this._onEditChar.bind(this));
      html.find(".name-gen").click(this._onNameClicked.bind(this));
      html.find(".ap-value").mousedown(this._onAPClick.bind(this));
      html.find(".stomp-icon").click(this._onStompClick.bind(this));
      html.find(".dodge-icon").click(this._onDodgeClick.bind(this));
      html.find(".repeater").click(this._onRepeaterClick.bind(this));
      html.find(".item-toggle").click(this._onItemToggle.bind(this));
      html.find(".item-remove").click(this._onItemRemove.bind(this));
      html.find(".item-delete").click(this._onItemDelete.bind(this));
      html.find(".fist-icon").click(this._onUnarmedClick.bind(this));
      html.find(".item-create").click(this._onItemCreate.bind(this));
      html.find(".aggregate").click(this._onAggregateClick.bind(this));
      html.find(".worn-container").click(this._onWornClick.bind(this));
      html.find(".effect-toggle").click(this._onEffectEdit.bind(this));
      html.find(".effect-title").click(this._onEffectClick.bind(this));
      html.find(".spell-roll").mousedown(this._onSpellRoll.bind(this));
      html.find(".trait-roll").mousedown(this._onTraitRoll.bind(this));
      html.find(".skill-switch").click(this._onSkillSwitch.bind(this));
      html.find(".item-post").click(this._onItemPostClicked.bind(this));
      html.find(".ammo-selector").change(this._onSelectAmmo.bind(this));
      html.find(".randomize").click(this._onRandomizeClicked.bind(this));
      html.find(".input.species").change(this._onSpeciesEdit.bind(this));
      html.find(".effect-target").click(this._onEffectTarget.bind(this));
      html.find(".effect-delete").click(this._onEffectDelete.bind(this));
      html.find(".prayer-roll").mousedown(this._onPrayerRoll.bind(this));
      html.find(".effect-create").click(this._onEffectCreate.bind(this));
      html.find(".item-checkbox").click(this._onCheckboxClick.bind(this));
      html.find(".sl-counter").mousedown(this._onSpellSLClick.bind(this));
      html.find(".spell-selector").change(this._onSelectSpell.bind(this));
      html.find(".dollar-icon").click(this._onMoneyIconClicked.bind(this));
      html.find(".disease-roll").mousedown(this._onDiseaseRoll.bind(this));
      html.find(".shield-total").mousedown(this._onShieldClick.bind(this));
      html.find(".test-select").click(this._onExtendedTestSelect.bind(this));
      html.find(".loaded-checkbox").mousedown(this._onLoadedClick.bind(this));
      html.find(".advance-diseases").click(this._onAdvanceDisease.bind(this));
      html.find(".memorized-toggle").click(this._onMemorizedClick.bind(this));
      html.find(".improvised-icon").click(this._onImprovisedClick.bind(this));
      html.find(".extended-SL").mousedown(this._onExtendedSLClick.bind(this));
      html.find(".condition-click").click(this._onConditionClicked.bind(this));
      html.find(".quantity-click").mousedown(this._onQuantityClick.bind(this));
      html.find(".weapon-item-name").click(this._onWeaponNameClick.bind(this));
      html.find(".armour-total").mousedown(this._onArmourTotalClick.bind(this));
      html.find(".auto-calc-toggle").mousedown(this._onAutoCalcToggle.bind(this));
      html.find(".weapon-damage").mousedown(this._onWeaponDamageClick.bind(this));
      html.find(".skill-advances").change(this._onChangeSkillAdvances.bind(this));
      html.find(".condition-toggle").mousedown(this._onConditionToggle.bind(this));
      html.find(".toggle-enc").click(this._onToggleContainerEncumbrance.bind(this));
      html.find(".ingredient-selector").change(this._onSelectIngredient.bind(this));
      html.find(".injury-duration").mousedown(this._onInjuryDurationClick.bind(this));
      html.find(".system-effect-select").change(this._onSystemEffectChanged.bind(this));
      html.find(".condition-value").mousedown(this._onConditionValueClicked.bind(this));
      html.find(".metacurrency-value").mousedown(this._onMetaCurrrencyClick.bind(this));
      html.find(".skill-total, .skill-select").mousedown(this._onSkillClick.bind(this));
      html.find(".tab.inventory .item .item-name").mousedown(this._onItemSplit.bind(this));
      html.find(".skill-advances, .ch-edit").focusin(this._saveFocus.bind(this));
      html.find(".attacker-remove").click(this._onAttackerRemove.bind(this));
      html.find(".currency-convert-right").click(this._onConvertCurrencyClick.bind(this));
      html.find(".sort-items").click(this._onSortClick.bind(this));
      html.find(".invoke").click(this._onInvokeClick.bind(this));
      let handler = this._onDragStart.bind(this);
      html.find(".item").each((i, li) => {
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
      html.on("dragenter", ".mount-drop", (ev) => {
        ev.target.classList.add("dragover");
      });
      html.on("dragleave", ".mount-drop", (ev) => {
        ev.target.classList.remove("dragover");
      });
      html.on("drop", ".mount-drop", async (ev) => {
        ev.target.classList.remove("dragover");
        let dragData = JSON.parse(ev.originalEvent.dataTransfer.getData("text/plain"));
        let mount = await Actor.implementation.fromDropData(dragData);
        if (game.wfrp4e.config.actorSizeNums[mount.details.size.value] < game.wfrp4e.config.actorSizeNums[this.actor.details.size.value])
          return ui.notifications.error(game.i18n.localize("MountError"));
        let mountData = {
          id: mount.id,
          mounted: true,
          isToken: false
        };
        if (this.actor.prototypeToken.actorLink && !mount.prototypeToken.actorLink)
          ui.notifications.warn(game.i18n.localize("WarnUnlinkedMount"));
        this.actor.update({ "system.status.mount": mountData });
      });
      html.find(".mount-toggle").click(this._onMountToggle.bind(this));
      html.find(".mount-remove").click(this._onMountRemove.bind(this));
      html.find(".mount-section").click((ev) => {
        this.actor.mount.sheet.render(true);
      });
      html.on("click", ".chat-roll", WFRP_Utility.handleRollClick.bind(WFRP_Utility));
      html.on("click", ".symptom-tag", WFRP_Utility.handleSymptomClick.bind(WFRP_Utility));
      html.on("click", ".condition-chat", WFRP_Utility.handleConditionClick.bind(WFRP_Utility));
      html.on("mousedown", ".table-click", WFRP_Utility.handleTableClick.bind(WFRP_Utility));
      html.on("mousedown", ".pay-link", WFRP_Utility.handlePayClick.bind(WFRP_Utility));
      html.on("mousedown", ".credit-link", WFRP_Utility.handleCreditClick.bind(WFRP_Utility));
      html.on("mousedown", ".corruption-link", WFRP_Utility.handleCorruptionClick.bind(WFRP_Utility));
      html.on("mousedown", ".fear-link", WFRP_Utility.handleFearClick.bind(WFRP_Utility));
      html.on("mousedown", ".terror-link", WFRP_Utility.handleTerrorClick.bind(WFRP_Utility));
      html.on("mousedown", ".exp-link", WFRP_Utility.handleExpClick.bind(WFRP_Utility));
    }
    _getItemId(ev) {
      return $(ev.currentTarget).parents(".item").attr("data-item-id");
    }
    _onCharClick(ev) {
      ev.preventDefault();
      let characteristic = ev.currentTarget.attributes["data-char"].value;
      this.actor.setupCharacteristic(characteristic).then((setupData) => {
        this.actor.basicTest(setupData);
      });
    }
    _onSkillClick(ev) {
      let itemId = this._getItemId(ev);
      let skill = this.actor.items.get(itemId);
      if (ev.button == 0) {
        skill = this.actor.items.get(itemId);
        this.actor.setupSkill(skill).then((setupData) => {
          this.actor.basicTest(setupData);
        });
      } else if (ev.button == 2) {
        skill.sheet.render(true);
      }
    }
    _onExtendedTestSelect(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      this.actor.setupExtendedTest(item);
    }
    _onWeaponNameClick(ev) {
      ev.preventDefault();
      let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let weapon2 = this.actor.items.get(itemId);
      if (weapon2)
        this.actor.setupWeapon(weapon2).then((setupData) => {
          if (!setupData.abort)
            this.actor.weaponTest(setupData);
        });
    }
    async _onUnarmedClick(ev) {
      ev.preventDefault();
      let unarmed = game.wfrp4e.config.systemItems.unarmed;
      this.actor.setupWeapon(unarmed).then((setupData) => {
        this.actor.weaponTest(setupData);
      });
    }
    async _onDodgeClick(ev) {
      this.actor.setupSkill(game.i18n.localize("NAME.Dodge")).then((setupData) => {
        this.actor.basicTest(setupData);
      });
    }
    async _onImprovisedClick(ev) {
      ev.preventDefault();
      let improv = game.wfrp4e.config.systemItems.improv;
      this.actor.setupWeapon(improv).then((setupData) => {
        this.actor.weaponTest(setupData);
      });
    }
    async _onStompClick(ev) {
      ev.preventDefault();
      let stomp = game.wfrp4e.config.systemItems.stomp;
      this.actor.setupTrait(stomp).then((setupData) => {
        this.actor.traitTest(setupData);
      });
    }
    async _onRestClick(ev) {
      let skill = this.actor.getItemTypes("skill").find((s) => s.name == game.i18n.localize("NAME.Endurance"));
      if (skill)
        this.actor.setupSkill(skill, { rest: true, tb: this.actor.characteristics.t.bonus }).then((setupData) => {
          this.actor.basicTest(setupData);
        });
      else
        this.actor.setupCharacteristic("t", { rest: true }).then((setupData) => {
          this.actor.basicTest(setupData);
        });
    }
    _onTraitRoll(ev) {
      ev.preventDefault();
      if (ev.button == 2)
        return this._onItemSummary(ev);
      let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let trait = this.actor.items.get(itemId);
      this.actor.setupTrait(trait).then((setupData) => {
        this.actor.traitTest(setupData);
      });
    }
    _onSpellRoll(ev) {
      ev.preventDefault();
      if (ev.button == 2)
        return this._onItemSummary(ev);
      let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let spell = this.actor.items.get(itemId);
      this.spellDialog(spell);
    }
    _onPrayerRoll(ev) {
      ev.preventDefault();
      if (ev.button == 2)
        return this._onItemSummary(ev);
      let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let prayer = this.actor.items.get(itemId);
      this.actor.setupPrayer(prayer).then((setupData) => {
        this.actor.prayerTest(setupData);
      });
    }
    _saveFocus(ev) {
      if (ev.target.attributes["data-item-id"])
        this.saveFocus = `data-item-id="${ev.target.attributes["data-item-id"].value}`;
      if (ev.target.attributes["data-char"])
        this.saveFocus = `data-char="${ev.target.attributes["data-char"].value}`;
    }
    async _onEditChar(ev) {
      ev.preventDefault();
      let characteristics = duplicate(this.actor._source.system.characteristics);
      let ch = ev.currentTarget.attributes["data-char"].value;
      let newValue = Number(ev.target.value);
      if (this.actor.type == "character") {
        let resolved = await WFRP_Utility.advancementDialog(ch, newValue, "characteristic", this.actor);
        if (!resolved) {
          ev.target.value = characteristics[ch].advances;
          return;
        } else
          characteristics[ch].advances = newValue;
      } else {
        if (!(newValue == characteristics[ch].initial + characteristics[ch].advances)) {
          characteristics[ch].initial = newValue;
          characteristics[ch].advances = 0;
        }
      }
      return this.actor.update({ "system.characteristics": characteristics });
    }
    async _onChangeSkillAdvances(ev) {
      ev.preventDefault();
      let itemId = ev.target.attributes["data-item-id"].value;
      let itemToEdit = this.actor.items.get(itemId);
      if (this.actor.type == "character") {
        let resolved = await WFRP_Utility.advancementDialog(
          itemToEdit,
          Number(ev.target.value),
          "skill",
          this.actor
        );
        if (!resolved) {
          ev.target.value = itemToEdit.advances.value;
          return;
        }
      }
      itemToEdit.update({ "system.advances.value": Number(ev.target.value) });
    }
    _onSelectAmmo(ev) {
      let itemId = ev.target.attributes["data-item-id"].value;
      const item = this.actor.items.get(itemId);
      WFRP_Audio.PlayContextAudio({ item, action: "load" });
      return item.update({ "system.currentAmmo.value": ev.target.value });
    }
    _onSelectSpell(ev) {
      let itemId = ev.target.attributes["data-item-id"].value;
      const ing = this.actor.items.get(itemId);
      return ing.update({ "system.spellIngredient.value": ev.target.value });
    }
    _onSelectIngredient(ev) {
      let itemId = ev.target.attributes["data-item-id"].value;
      const spell = this.actor.items.get(itemId);
      return spell.update({ "system.currentIng.value": ev.target.value });
    }
    _onSkillSwitch(ev) {
      this.actor.setFlag("wfrp4e", "showExtendedTests", !getProperty(this.actor, "flags.wfrp4e.showExtendedTests"));
      this.render(true);
    }
    _onExtendedSLClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      let SL;
      if (ev.button == 0)
        SL = item.SL.current + 1;
      else if (ev.button == 2)
        SL = item.SL.current - 1;
      if (SL < 0 && !item.negativePossible.value)
        SL = 0;
      return item.update({ "system.SL.current": SL });
    }
    _onAPClick(ev) {
      let itemId = this._getItemId(ev);
      let APlocation = $(ev.currentTarget).parents(".armour-box").attr("data-location");
      let item = this.actor.items.get(itemId);
      let itemData = item.toObject();
      let maxDamageAtLocation = item.AP[APlocation] + Number(item.properties.qualities.durable?.value || 0);
      let minDamageAtLocation = 0;
      switch (ev.button) {
        case 2:
          itemData.system.APdamage[APlocation] = Math.min(maxDamageAtLocation, itemData.system.APdamage[APlocation] + 1);
          break;
        case 0:
          itemData.system.APdamage[APlocation] = Math.max(minDamageAtLocation, itemData.system.APdamage[APlocation] - 1);
          break;
      }
      this.actor.updateEmbeddedDocuments("Item", [itemData]);
    }
    _onWeaponDamageClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      let itemData = item.toObject();
      let regex = /\d{1,3}/gm;
      let maxDamage = Number(regex.exec(item.damage.value)[0] || 0) + Number(item.properties.qualities.durable?.value || 0) || 999;
      let minDamage = 0;
      if (ev.button == 2) {
        itemData.system.damageToItem.value = Math.min(maxDamage, itemData.system.damageToItem.value + 1);
        WFRP_Audio.PlayContextAudio({ item, action: "damage", outcome: "weapon" });
      } else if (ev.button == 0)
        itemData.system.damageToItem.value = Math.max(minDamage, itemData.system.damageToItem.value - 1);
      if (maxDamage == itemData.system.damageToItem.value) {
        itemData.system.equipped = false;
      }
      this.actor.updateEmbeddedDocuments("Item", [itemData]);
    }
    _onArmourTotalClick(ev) {
      let location = $(ev.currentTarget).closest(".column").find(".armour-box").attr("data-location");
      if (!location)
        location = $(ev.currentTarget).closest(".column").attr("data-location");
      if (!location)
        return;
      let armourTraits = this.actor.getItemTypes("trait").filter((i) => i.name.toLowerCase() == game.i18n.localize("NAME.Armour").toLowerCase()).map((i) => i.toObject());
      let armourItems = this.actor.getItemTypes("armour").filter((i) => i.isEquipped).sort((a, b) => a.sort - b.sort);
      let armourToDamage;
      let usedTrait = false;
      for (let armourTrait of armourTraits) {
        if (armourTrait && !getProperty(armourTrait, "flags.wfrp4e.APdamage"))
          setProperty(armourTrait, "flags.wfrp4e.APdamage", { head: 0, body: 0, lArm: 0, rArm: 0, lLeg: 0, rLeg: 0 });
        if (armourTrait) {
          if (ev.button == 0) {
            if (armourTrait.flags.wfrp4e.APdamage[location] != 0) {
              armourTrait.flags.wfrp4e.APdamage[location]--;
              usedTrait = true;
            }
          }
          if (ev.button == 2) {
            if (armourTrait.flags.wfrp4e.APdamage[location] == Number(armourTrait.system.specification.value)) {
              continue;
            }
            if (armourTrait.flags.wfrp4e.APdamage[location] != Number(armourTrait.system.specification.value)) {
              armourTrait.flags.wfrp4e.APdamage[location]++;
              usedTrait = true;
            }
          }
          if (usedTrait)
            return this.actor.updateEmbeddedDocuments("Item", [armourTrait]);
        }
      }
      if (armourItems && !usedTrait) {
        if (ev.button == 0)
          armourItems.reverse();
        for (let a of armourItems) {
          if (ev.button == 2) {
            if (a.currentAP[location] > 0) {
              armourToDamage = a;
              break;
            }
          } else if (ev.button == 0) {
            if (a.AP[location] > 0 && a.APdamage[location] > 0) {
              armourToDamage = a;
              break;
            }
          }
        }
      }
      if (!armourToDamage)
        return;
      let durable = armourToDamage.properties.qualities.durable;
      armourToDamage = armourToDamage.toObject();
      if (ev.button == 2) {
        armourToDamage.system.APdamage[location] = Math.min(armourToDamage.system.AP[location] + (Number(durable?.value) || 0), armourToDamage.system.APdamage[location] + 1);
        ui.notifications.notify(game.i18n.localize("SHEET.ArmourDamaged"));
      }
      if (ev.button == 0) {
        armourToDamage.system.APdamage[location] = Math.max(0, armourToDamage.system.APdamage[location] - 1);
        ui.notifications.notify(game.i18n.localize("SHEET.ArmourRepaired"));
      }
      return this.actor.updateEmbeddedDocuments("Item", [armourToDamage]);
    }
    _onShieldClick(ev) {
      let shields = this.actor.getItemTypes("weapon").filter((i) => i.isEquipped && i.properties.qualities.shield);
      for (let s of shields) {
        let shieldQualityValue = s.properties.qualities.shield.value;
        if (ev.button == 2) {
          if (s.damageToItem.shield < Number(shieldQualityValue)) {
            WFRP_Audio.PlayContextAudio({ item: s, action: "damage", outcome: "shield" });
            return s.update({ "system.damageToItem.shield": s.damageToItem.shield + 1 });
          }
        }
        if (ev.button == 0) {
          if (s.damageToItem.shield != 0) {
            return s.update({ "system.damageToItem.shield": s.damageToItem.shield - 1 });
          }
        }
      }
    }
    async _onMemorizedClick(ev) {
      let itemId = this._getItemId(ev);
      const spell = this.actor.items.get(itemId);
      if (spell.memorized.value) {
        WFRP_Audio.PlayContextAudio({ item: spell, action: "unmemorize" });
        return spell.update({ "system.memorized.value": !spell.memorized.value });
      }
      let memorize = true;
      if (this.actor.type == "character") {
        memorize = await WFRP_Utility.memorizeCostDialog(spell, this.actor);
      }
      if (!memorize)
        return;
      if (!spell.memorized.value)
        WFRP_Audio.PlayContextAudio({ item: spell, action: "memorize" });
      else
        WFRP_Audio.PlayContextAudio({ item: spell, action: "unmemorize" });
      return spell.update({ "system.memorized.value": !spell.memorized.value });
    }
    _onSpellSLClick(ev) {
      let itemId = this._getItemId(ev);
      const spell = this.actor.items.get(itemId);
      let SL = spell.cn.SL;
      switch (ev.button) {
        case 0:
          SL++;
          if (SL > (spell.memorized.value ? spell.cn.value : spell.cn.value * 2))
            SL = spell.memorized.value ? spell.cn.value : spell.cn.value * 2;
          break;
        case 2:
          SL--;
          if (SL < 0)
            SL = 0;
          break;
      }
      return spell.update({ "system.cn.SL": SL });
    }
    async _onAutoCalcToggle(ev) {
      let toggle = ev.target.attributes["toggle-type"].value;
      if (ev.button == 2) {
        let newFlags = duplicate(this.actor.flags);
        if (toggle == "walk")
          newFlags.autoCalcWalk = !newFlags.autoCalcWalk;
        else if (toggle == "run")
          newFlags.autoCalcRun = !newFlags.autoCalcRun;
        else if (toggle == "wounds")
          newFlags.autoCalcWounds = !newFlags.autoCalcWounds;
        else if (toggle == "critW")
          newFlags.autoCalcCritW = !newFlags.autoCalcCritW;
        else if (toggle == "corruption")
          newFlags.autoCalcCorruption = !newFlags.autoCalcCorruption;
        else if (toggle == "encumbrance")
          newFlags.autoCalcEnc = !newFlags.autoCalcEnc;
        return this.actor.update({ "flags": newFlags });
      }
    }
    async _onDiseaseRoll(ev) {
      let itemId = this._getItemId(ev);
      const disease = this.actor.items.get(itemId).toObject();
      let type = ev.target.dataset["type"];
      if (type == "incubation")
        disease.system.duration.active = false;
      if (!isNaN(disease.system[type].value)) {
        let number = Number(disease.system[type].value);
        if (ev.button == 0)
          return this.actor.decrementDisease(disease);
        else
          number++;
        disease.system[type].value = number;
        return this.actor.updateEmbeddedDocuments("Item", [disease]);
      } else if (ev.button == 0) {
        try {
          let rollValue = (await new Roll(disease.system[type].value).roll()).total;
          disease.system[type].value = rollValue;
          if (type == "duration")
            disease.system.duration.active = true;
        } catch {
          return ui.notifications.error(game.i18n.localize("ERROR.ParseDisease"));
        }
        return this.actor.updateEmbeddedDocuments("Item", [disease]);
      }
    }
    async _onInjuryDurationClick(ev) {
      let itemId = this._getItemId(ev);
      let injury = this.actor.items.get(itemId).toObject();
      if (!isNaN(injury.system.duration.value)) {
        if (ev.button == 0)
          return this.actor.decrementInjury(injury);
        else
          injury.system.duration.value++;
        return this.actor.updateEmbeddedDocuments("Item", [injury]);
      } else {
        try {
          let rollValue = (await new Roll(injury.system.duration.value).roll()).total;
          injury.system.duration.value = rollValue;
          injury.system.duration.active = true;
          return this.actor.updateEmbeddedDocuments("Item", [injury]);
        } catch {
          return ui.notifications.error(game.i18n.localize("ERROR.ParseInjury"));
        }
      }
    }
    async _onMetaCurrrencyClick(ev) {
      let type = $(ev.currentTarget).attr("data-point-type");
      let newValue = ev.button == 0 ? this.actor.status[type].value + 1 : this.actor.status[type].value - 1;
      return this.actor.update({ [`system.status.${type}.value`]: newValue });
    }
    _onItemEdit(ev) {
      let itemId = this._getItemId(ev);
      const item = this.actor.items.get(itemId);
      return item.sheet.render(true);
    }
    _onEffectClick(ev) {
      let id = this._getItemId(ev);
      let effect = this.actor.actorEffects.get(id);
      return effect.sheet.render(true);
    }
    _onEffectDelete(ev) {
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      return this.actor.deleteEmbeddedDocuments("ActiveEffect", [id]);
    }
    _onEffectEdit(ev) {
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let effect = this.actor.actorEffects.get(id);
      return effect.update({ disabled: !effect.disabled });
    }
    _onEffectTarget(ev) {
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let effect = this.actor.actorEffects.get(id);
      if (effect.trigger == "apply")
        game.wfrp4e.utility.applyEffectToTarget(effect);
      else {
        try {
          let asyncFunction = Object.getPrototypeOf(async function() {
          }).constructor;
          let func = new asyncFunction("args", effect.script).bind({ actor: this.actor, effect, item: effect.item });
          func({ actor: this.actor, effect, item: effect.item });
        } catch (ex) {
          ui.notifications.error("Error when running effect " + effect.label + ", please see the console (F12)");
          console.error("Error when running effect " + effect.label + " - If this effect comes from an official module, try replacing the actor/item from the one in the compendium. If it still throws this error, please use the Bug Reporter and paste the details below, as well as selecting which module and 'Effect Report' as the label.");
          console.error(`REPORT
-------------------
EFFECT:	${effect.label}
ACTOR:	${this.actor.name} - ${this.actor.id}
ERROR:	${ex}`);
        }
      }
    }
    _onAdvanceDisease(ev) {
      return this.actor.decrementDiseases();
    }
    _onItemDelete(ev) {
      let li = $(ev.currentTarget).parents(".item"), itemId = li.attr("data-item-id");
      if (this.actor.items.get(itemId).name == "Boo") {
        AudioHelper.play({ src: `${game.settings.get("wfrp4e", "soundPath")}squeek.wav` }, false);
        return;
      }
      renderTemplate("systems/wfrp4e/templates/dialog/delete-item-dialog.html").then((html) => {
        new Dialog({
          title: game.i18n.localize("Delete Confirmation"),
          content: html,
          buttons: {
            Yes: {
              icon: '<i class="fa fa-check"></i>',
              label: game.i18n.localize("Yes"),
              callback: async (dlg) => {
                await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                this.actor.deleteEffectsFromItem(itemId);
                li.slideUp(200, () => this.render(false));
              }
            },
            cancel: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Cancel") }
          },
          default: "Yes"
        }).render(true);
      });
    }
    _onItemRemove(ev) {
      let li = $(ev.currentTarget).parents(".item"), itemId = li.attr("data-item-id");
      const item = this.actor.items.get(itemId);
      return item.update({ "system.location.value": "" });
    }
    _onToggleContainerEncumbrance(ev) {
      let itemId = this._getItemId(ev);
      const item = this.actor.items.get(itemId);
      return item.update({ "system.countEnc.value": !item.countEnc.value });
    }
    _onItemToggle(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId).toObject();
      let equippedState;
      if (item.type == "armour") {
        item.system.worn.value = !item.system.worn.value;
        equippedState = item.system.worn.value;
      } else if (item.type == "weapon") {
        item.system.equipped = !item.system.equipped;
        equippedState = item.system.equipped;
        let newEqpPoints = item.system.twohanded.value ? 2 : 1;
        if (game.settings.get("wfrp4e", "limitEquippedWeapons") && this.actor.type != "vehicle") {
          if (this.actor.equipPointsUsed + newEqpPoints > this.actor.equipPointsAvailable && equippedState) {
            AudioHelper.play({ src: `${game.settings.get("wfrp4e", "soundPath")}/no.wav` }, false);
            return ui.notifications.error(game.i18n.localize("ErrorLimitedWeapons"));
          }
        }
        setProperty(item, "system.offhand.value", false);
      } else if (item.type == "trapping" && item.system.trappingType.value == "clothingAccessories") {
        item.system.worn = !item.system.worn;
        equippedState = item.system.worn;
      }
      WFRP_Audio.PlayContextAudio({ item: this.actor.items.get(itemId), action: "equip", outcome: equippedState });
      this.actor.updateEmbeddedDocuments("Item", [item]);
    }
    _onCheckboxClick(ev) {
      let itemId = this._getItemId(ev);
      let target = $(ev.currentTarget).attr("data-target");
      this.toggleItemCheckbox(itemId, target);
    }
    _onLoadedClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      let itemObject = item.toObject();
      if (item.repeater) {
        if (ev.button == 0 && itemObject.system.loaded.amt >= itemObject.system.loaded.max)
          return;
        if (ev.button == 2 && itemObject.system.loaded.amt <= 0)
          return;
        if (ev.button == 0)
          itemObject.system.loaded.amt++;
        if (ev.button == 2)
          itemObject.system.loaded.amt--;
        itemObject.system.loaded.value = !!itemObject.system.loaded.amt;
      } else {
        itemObject.system.loaded.value = !itemObject.system.loaded.value;
        if (itemObject.system.loaded.value)
          itemObject.system.loaded.amt = itemObject.system.loaded.max || 1;
        else
          itemObject.system.loaded.amt = 0;
      }
      this.actor.updateEmbeddedDocuments("Item", [itemObject]).then((i) => this.actor.checkReloadExtendedTest(item));
    }
    _onRepeaterClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId).toObject();
      item.system.loaded.value = !item.system.loaded.value;
      if (item.system.loaded.value)
        item.system.loaded.amt = item.system.loaded.max || 1;
      this.actor.updateEmbeddedDocuments("Item", [item]);
    }
    _onWornClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      return item.update({ "system.worn.value": !item.worn.value });
    }
    _onQuantityClick(ev) {
      let itemId = this._getItemId(ev);
      let item = this.actor.items.get(itemId);
      let quantity = item.quantity.value;
      switch (ev.button) {
        case 0:
          if (ev.ctrlKey)
            quantity += 10;
          else
            quantity++;
          break;
        case 2:
          if (ev.ctrlKey)
            quantity -= 10;
          else
            quantity--;
          if (quantity < 0)
            quantity = 0;
          break;
      }
      item.update({ "system.quantity.value": quantity });
    }
    async _onAggregateClick(ev) {
      let itemType = $(ev.currentTarget).attr("data-type");
      if (itemType == "ingredient")
        itemType = "trapping";
      let items = this.actor.getItemTypes(itemType).map((i) => i.toObject());
      for (let i of items) {
        let duplicates = items.filter((x) => x.name == i.name);
        if (duplicates.length > 1) {
          let newQty = duplicates.reduce((prev, current) => prev + parseInt(current.system.quantity.value), 0);
          i.system.quantity.value = newQty;
        }
      }
      let noDuplicates = [];
      for (let i of items) {
        if (!noDuplicates.find((x) => x.name == i.name)) {
          noDuplicates.push(i);
          await this.actor.updateEmbeddedDocuments("Item", [{ "_id": i._id, "system.quantity.value": i.system.quantity.value }]);
        } else
          await this.actor.deleteEmbeddedDocuments("Item", [i._id]);
      }
    }
    _onItemSplit(ev) {
      if (ev.button == 2) {
        new Dialog({
          title: game.i18n.localize("SHEET.SplitTitle"),
          content: `<p>${game.i18n.localize("SHEET.SplitPrompt")}</p><div class="form-group"><input name="split-amt"type="text"/></div>`,
          buttons: {
            split: {
              label: game.i18n.localize("Split"),
              callback: (dlg) => {
                let amt = Number(dlg.find('[name="split-amt"]').val());
                if (Number.isNumeric(amt))
                  return this.splitItem(this._getItemId(ev), amt);
              }
            }
          },
          default: "split"
        }).render(true);
      }
    }
    _onConditionValueClicked(ev) {
      let condKey = $(ev.currentTarget).parents(".sheet-condition").attr("data-cond-id");
      if (ev.button == 0)
        this.actor.addCondition(condKey);
      else if (ev.button == 2)
        this.actor.removeCondition(condKey);
    }
    _onConditionToggle(ev) {
      let condKey = $(ev.currentTarget).parents(".sheet-condition").attr("data-cond-id");
      if (game.wfrp4e.config.statusEffects.find((e) => e.id == condKey).flags.wfrp4e.value == null) {
        if (this.actor.hasCondition(condKey))
          this.actor.removeCondition(condKey);
        else
          this.actor.addCondition(condKey);
        return;
      }
      if (ev.button == 0)
        this.actor.addCondition(condKey);
      else if (ev.button == 2)
        this.actor.removeCondition(condKey);
    }
    async _onSpeciesEdit(ev) {
      let input = ev.target.value;
      let split = input.split("(");
      let species = split[0].trim();
      let subspecies;
      if (split.length > 1)
        subspecies = split[1].replace(")", "").trim();
      let speciesKey = WFRP_Utility.findKey(species, game.wfrp4e.config.species) || species;
      let subspeciesKey = "";
      if (subspecies) {
        for (let sub in game.wfrp4e.config.subspecies[speciesKey]) {
          if (game.wfrp4e.config.subspecies[speciesKey][sub].name == subspecies)
            subspeciesKey = sub;
        }
        if (!subspeciesKey)
          subspeciesKey = subspecies;
      }
      await this.actor.update({ "system.details.species.value": speciesKey, "system.details.species.subspecies": subspeciesKey });
      if (this.actor.type == "character")
        return;
      try {
        let initialValues = await WFRP_Utility.speciesCharacteristics(speciesKey, true, subspeciesKey);
        let characteristics = this.actor.toObject().system.characteristics;
        for (let c in characteristics) {
          characteristics[c].initial = initialValues[c].value;
        }
        new Dialog({
          content: game.i18n.localize("SpecChar"),
          title: game.i18n.localize("Species Characteristics"),
          buttons: {
            yes: {
              label: game.i18n.localize("Yes"),
              callback: async () => {
                await this.actor.update({ "system.characteristics": characteristics });
                await this.actor.update({ "system.details.move.value": WFRP_Utility.speciesMovement(species) || 4 });
              }
            },
            no: { label: game.i18n.localize("No"), callback: () => {
            } }
          }
        }).render(true);
      } catch {
      }
    }
    async _onRandomizeClicked(ev) {
      ev.preventDefault();
      let species = this.actor.details.species.value;
      let subspecies = this.actor.details.species.subspecies;
      try {
        switch (ev.target.text) {
          case game.i18n.localize("RANDOMIZER.C"):
            let creatureMethod = false;
            let characteristics = this.actor.toObject().system.characteristics;
            if (this.actor.type == "creature" || !species)
              creatureMethod = true;
            if (!creatureMethod) {
              let averageCharacteristics = await WFRP_Utility.speciesCharacteristics(species, true, subspecies);
              for (let char in characteristics) {
                if (characteristics[char].initial != averageCharacteristics[char].value)
                  creatureMethod = true;
              }
            }
            if (!creatureMethod) {
              let rolledCharacteristics = await WFRP_Utility.speciesCharacteristics(species, false, subspecies);
              for (let char in rolledCharacteristics) {
                characteristics[char].initial = rolledCharacteristics[char].value;
              }
              await this.actor.update({ "system.characteristics": characteristics });
            } else if (creatureMethod) {
              let roll = new Roll("2d10");
              await roll.roll();
              let characteristics2 = this.actor.toObject().system.characteristics;
              for (let char in characteristics2) {
                if (characteristics2[char].initial == 0)
                  continue;
                characteristics2[char].initial -= 10;
                characteristics2[char].initial += (await roll.reroll()).total;
                if (characteristics2[char].initial < 0)
                  characteristics2[char].initial = 0;
              }
              await this.actor.update({ "system.characteristics": characteristics2 });
            }
            return;
          case game.i18n.localize("RANDOMIZER.S"):
            this.actor._advanceSpeciesSkills();
            return;
          case game.i18n.localize("RANDOMIZER.T"):
            this.actor._advanceSpeciesTalents();
            return;
        }
      } catch (error2) {
        WFRP_Utility.log("Could not randomize: " + error2, true);
      }
    }
    async _onConditionClicked(ev) {
      ev.preventDefault();
      let li = $(ev.currentTarget).parents(".sheet-condition"), elementToAddTo = $(ev.currentTarget).parents(".condition-list"), condkey = li.attr("data-cond-id"), expandData = await TextEditor.enrichHTML(`<h2>${game.wfrp4e.config.conditions[condkey]}</h2>` + game.wfrp4e.config.conditionDescriptions[condkey], { async: true });
      if (elementToAddTo.hasClass("expanded")) {
        let summary = elementToAddTo.parents(".effects").children(".item-summary");
        summary.slideUp(200, () => summary.remove());
      } else {
        let div = $(`<div class="item-summary">${expandData}</div>`);
        if (game.wfrp4e.config.conditionScripts[condkey] && this.actor.hasCondition(condkey)) {
          let button = $(`<br><br><a class="condition-script">${game.i18n.format("CONDITION.Apply", { condition: game.wfrp4e.config.conditions[condkey] })}</a>`);
          div.append(button);
        }
        elementToAddTo.after(div.hide());
        div.slideDown(200);
        div.on("click", ".condition-script", async (ev2) => {
          ui.sidebar.activateTab("chat");
          ChatMessage.create(await game.wfrp4e.config.conditionScripts[condkey](this.actor));
        });
      }
      elementToAddTo.toggleClass("expanded");
    }
    _onItemPostClicked(ev) {
      let itemId = this._getItemId(ev);
      const item = this.actor.items.get(itemId);
      item.postItem();
    }
    _onNameClicked(ev) {
      let name = NameGenWfrp.generateName({ species: this.actor.details.species.value, gender: this.actor.details.gender.value });
      this.actor.update({ "name": name });
    }
    _onMountToggle(ev) {
      ev.stopPropagation();
      this.actor.update({ "system.status.mount.mounted": !this.actor.status.mount.mounted });
    }
    _onMountRemove(ev) {
      ev.stopPropagation();
      let mountData = { id: "", mounted: false, isToken: false };
      this.actor.update({ "system.status.mount": mountData });
    }
    _onAttackerRemove(ev) {
      this.actor.update({ "flags.-=oppose": null });
    }
    _onMountClicked(ev) {
      this.actor.mount.sheet.render(true);
    }
    _onSystemEffectChanged(ev) {
      let ef = ev.target.value;
      this.actor.addSystemEffect(ef);
    }
    _onMoneyIconClicked(ev) {
      ev.preventDefault();
      let money = this.actor.getItemTypes("money");
      let newMoney = MarketWfrp4e.consolidateMoney(money.map((i) => i.toObject()));
      return this.actor.updateEmbeddedDocuments("Item", newMoney);
    }
    _onItemCreate(ev) {
      ev.preventDefault();
      let header = ev.currentTarget, data = duplicate(header.dataset);
      if (data.type == "effect")
        return this.actor.createEmbeddedDocuments("ActiveEffect", [{ name: game.i18n.localize("New Effect") }]);
      if (data.type == "vehicle-role" && this.actor.type == "vehicle") {
        let roles = duplicate(this.actor.roles);
        let newRole = { name: game.i18n.localize("NewRole"), actor: "", test: "", testLabel: "" };
        roles.push(newRole);
        return this.actor.update({ "system.roles": roles });
      }
      if (ev.currentTarget.attributes["data-type"].value == "skill") {
        data = mergeObject(
          data,
          {
            "system.advanced.value": ev.currentTarget.attributes["data-skill-type"].value
          }
        );
      }
      if (data.type == "trapping")
        data = mergeObject(
          data,
          {
            "system.trappingType.value": ev.currentTarget.attributes["item-section"].value
          }
        );
      if (data.type == "ingredient") {
        data = mergeObject(
          data,
          {
            "system.trappingType.value": "ingredient"
          }
        );
        data.type = "trapping";
      } else if (data.type == "spell" || data.type == "prayer") {
        let itemSpecification = ev.currentTarget.attributes[`data-${data.type}-type`].value;
        if (data.type == "spell") {
          data = mergeObject(
            data,
            {
              "system.lore.value": itemSpecification
            }
          );
        } else if (data.type == "prayer") {
          data = mergeObject(
            data,
            {
              "system.type.value": itemSpecification
            }
          );
        }
      }
      data["img"] = "systems/wfrp4e/icons/blank.png";
      data["name"] = `${game.i18n.localize("New")} ${data.type.capitalize()}`;
      this.actor.createEmbeddedDocuments("Item", [data]);
    }
    _onEffectCreate(ev) {
      let type = ev.currentTarget.attributes["data-effect"].value;
      let effectData = { label: game.i18n.localize("New Effect") };
      if (type == "temporary") {
        effectData["duration.rounds"] = 1;
      }
      if (type == "applied") {
        effectData["flags.wfrp4e.effectApplication"] = "apply";
      }
      this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    _onInvokeClick(ev) {
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      game.wfrp4e.utility.invokeEffect(this.actor, id);
    }
    _onDragStart(event2) {
      const li = event2.currentTarget;
      if (event2.target.classList.contains("content-link"))
        return;
      let dragData;
      if (li.dataset.itemId) {
        const item = this.actor.items.get(li.dataset.itemId);
        dragData = item.toDragData();
      }
      if (li.dataset.effectId) {
        const effect = this.actor.effects.get(li.dataset.effectId);
        dragData = effect.toDragData();
      }
      if (!dragData)
        return;
      dragData.root = event2.currentTarget.getAttribute("root");
      event2.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }
    async _onDrop(ev) {
      let dragData = JSON.parse(ev.dataTransfer.getData("text/plain"));
      if ($(ev.target).parents(".item").attr("inventory-type") == "container")
        this._onDropIntoContainer(ev);
      else if (dragData.type == "postedItem")
        this.actor.createEmbeddedDocuments("Item", [dragData.payload]);
      else if (dragData.type == "generation")
        this._onDropCharGen(dragData);
      else if (dragData.type == "lookup")
        this._onDropLookupItem(dragData);
      else if (dragData.type == "experience")
        this._onDropExperience(dragData);
      else if (dragData.type == "money")
        this._onDropMoney(dragData);
      else if (dragData.type == "wounds")
        this.modifyWounds(`+${dragData.payload}`);
      else if (dragData.type == "condition")
        this.actor.addCondition(`${dragData.payload}`);
      else
        super._onDrop(ev);
    }
    async _onDropIntoContainer(ev) {
      let dragData = JSON.parse(ev.dataTransfer.getData("text/plain"));
      let dropID = $(ev.target).parents(".item").attr("data-item-id");
      let item = (await Item.implementation.fromDropData(dragData))?.toObject();
      item.system.location.value = dropID;
      if (item.type == "armour")
        item.system.worn.value = false;
      if (item.type == "weapon")
        item.system.equipped = false;
      if (item.type == "trapping" && item.system.trappingType.value == "clothingAccessories")
        item.system.worn = false;
      return this.actor.updateEmbeddedDocuments("Item", [item]);
    }
    _onDropCharGen(dragData) {
      let data = duplicate(this.actor._source.system);
      if (dragData.generationType == "attributes") {
        data.details.species.value = dragData.payload.species;
        data.details.species.subspecies = dragData.payload.subspecies;
        data.details.move.value = dragData.payload.movement;
        if (this.actor.type == "character") {
          data.status.fate.value = dragData.payload.fate;
          data.status.fortune.value = dragData.payload.fate;
          data.status.resilience.value = dragData.payload.resilience;
          data.status.resolve.value = dragData.payload.resilience;
          data.details.experience.total += dragData.payload.exp;
          data.details.experience.log = this.actor._addToExpLog(dragData.payload.exp, "Character Creation", void 0, data.details.experience.total);
        }
        for (let c in game.wfrp4e.config.characteristics) {
          data.characteristics[c].initial = dragData.payload.characteristics[c].value;
        }
        return this.actor.update({ "data": data });
      } else if (dragData.generationType === "details") {
        data.details.eyecolour.value = dragData.payload.eyes;
        data.details.haircolour.value = dragData.payload.hair;
        data.details.age.value = dragData.payload.age;
        data.details.height.value = dragData.payload.height;
        let name = dragData.payload.name;
        return this.actor.update({ "name": name, "data": data, "token.name": name.split(" ")[0] });
      }
    }
    async _onDropLookupItem(dragData) {
      let item;
      if (dragData.payload.lookupType === "skill") {
        item = await WFRP_Utility.findSkill(dragData.payload.name);
      } else if (dragData.payload.lookupType === "talent") {
        item = await WFRP_Utility.findTalent(dragData.payload.name);
      } else {
        item = await WFRP_Utility.findItem(dragData.payload.name, dragData.payload.lookupType);
      }
      if (item)
        this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }
    _onDropExperience(dragData) {
      let system = duplicate(this.actor._source.system);
      system.details.experience.total += dragData.payload;
      system.details.experience.log = this.actor._addToExpLog(dragData.payload, "Character Creation", void 0, system.details.experience.total);
      this.actor.update({ "system": system });
    }
    _onDropMoney(dragData) {
      let moneyString = dragData.payload;
      let type = moneyString.slice(-1);
      let amt;
      let halfS = false, halfG = false;
      if (type === "b")
        amt = Math.round(moneyString.slice(0, -1));
      else if (type === "s") {
        if (moneyString.slice(0, -1).includes("."))
          halfS = true;
        amt = Math.floor(moneyString.slice(0, -1));
      } else if (type === "g") {
        if (moneyString.slice(0, -1).includes("."))
          halfG = true;
        amt = Math.floor(moneyString.slice(0, -1));
      }
      let money = this.actor.getItemTypes("money").map((m) => m.toObject());
      let moneyItem;
      switch (type) {
        case "b":
          moneyItem = money.find((i) => i.name === game.i18n.localize("NAME.BP"));
          break;
        case "s":
          moneyItem = money.find((i) => i.name === game.i18n.localize("NAME.SS"));
          break;
        case "g":
          moneyItem = money.find((i) => i.name === game.i18n.localize("NAME.GC"));
          break;
      }
      if (!amt && !halfG && !halfS)
        money.forEach((m) => m.system.quantity.value = 0);
      else
        moneyItem.system.quantity.value += amt;
      if (halfS)
        money.find((i) => i.name === game.i18n.localize("NAME.BP")).system.quantity.value += 6;
      if (halfG)
        money.find((i) => i.name === game.i18n.localize("NAME.SS")).system.quantity.value += 10;
      this.actor.updateEmbeddedDocuments("Item", money);
    }
    _onConvertCurrencyClick(ev) {
      let type = ev.currentTarget.dataset.type;
      let money = this.actor.getItemTypes("money").map((m) => m.toObject());
      if (type == "gc") {
        let currentGC = money.find((i) => i.name == game.i18n.localize("NAME.GC"));
        let currentSS = money.find((i) => i.name == game.i18n.localize("NAME.SS"));
        if (currentGC && currentSS && currentGC.system.quantity.value) {
          currentGC.system.quantity.value -= 1;
          currentSS.system.quantity.value += 20;
          return this.actor.updateEmbeddedDocuments("Item", [currentGC, currentSS]);
        } else
          return ui.notifications.error(game.i18n.localize("ErrorMoneyConvert"));
      }
      if (type == "ss") {
        let currentSS = money.find((i) => i.name == game.i18n.localize("NAME.SS"));
        let currentBP = money.find((i) => i.name == game.i18n.localize("NAME.BP"));
        if (currentBP && currentSS && currentSS.system.quantity.value) {
          currentSS.system.quantity.value -= 1;
          currentBP.system.quantity.value += 12;
          return this.actor.updateEmbeddedDocuments("Item", [currentBP, currentSS]);
        } else
          return ui.notifications.error(game.i18n.localize("ErrorMoneyConvert"));
      }
    }
    async _onItemSummary(ev) {
      ev.preventDefault();
      let li = $(ev.currentTarget).parents(".item"), item = this.actor.items.get(li.attr("data-item-id"));
      let expandData = await item.getExpandData(
        {
          secrets: this.actor.isOwner
        }
      );
      if (li.hasClass("expanded")) {
        let summary = li.children(".item-summary");
        summary.slideUp(200, () => summary.remove());
      } else {
        let div = "";
        div = $(`<div class="item-summary">${expandData.description.value}</div>`);
        let props = $(`<div class="item-properties"></div>`);
        expandData.properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
        div.append(props);
        if (expandData.targetEffects.length) {
          let effectButtons = expandData.targetEffects.map((e) => `<a class="apply-effect" data-item-id=${item.id} data-effect-id=${e.id}>${game.i18n.format("SHEET.ApplyEffect", { effect: e.label })}</a>`);
          let effects = $(`<div>${effectButtons}</div>`);
          div.append(effects);
        }
        if (expandData.invokeEffects.length) {
          let effectButtons = expandData.invokeEffects.map((e) => `<a class="invoke-effect" data-item-id=${item.id} data-effect-id=${e.id}>${game.i18n.format("SHEET.InvokeEffect", { effect: e.label })}</a>`);
          let effects = $(`<div>${effectButtons}</div>`);
          div.append(effects);
        }
        li.append(div.hide());
        div.slideDown(200);
        this._dropdownListeners(div);
      }
      li.toggleClass("expanded");
    }
    _dropdownListeners(html) {
      html.on("click", ".item-property", (ev) => {
        WFRP_Utility.postProperty(ev.target.text);
      });
      html.on("click", ".career-income", (ev) => {
        let skill = this.actor.getItemTypes("skill").find((i) => i.name === ev.target.text.trim());
        let career = this.actor.items.get($(ev.target).attr("data-career-id"));
        if (!skill) {
          ui.notifications.error(game.i18n.localize("SHEET.SkillMissingWarning"));
          return;
        }
        if (!career.current.value) {
          ui.notifications.error(game.i18n.localize("SHEET.NonCurrentCareer"));
          return;
        }
        this.actor.setupSkill(skill, { title: `${skill.name} - ${game.i18n.localize("Income")}`, income: this.actor.details.status, career: career.toObject() }).then((setupData) => {
          this.actor.basicTest(setupData);
        });
      });
      html.on("click", ".apply-effect", async (ev) => {
        let effectId = ev.target.dataset["effectId"];
        let itemId = ev.target.dataset["itemId"];
        let effect = this.actor.populateEffect(effectId, itemId);
        let item = this.actor.items.get(itemId);
        if (effect.flags.wfrp4e?.reduceQuantity) {
          if (item.quantity.value > 0)
            item.update({ "system.quantity.value": item.quantity.value - 1 });
          else
            throw ui.notifications.error(game.i18n.localize("EFFECT.QuantityError"));
        }
        if (item.range && item.range.value.toLowerCase() == game.i18n.localize("You").toLowerCase() && (item.target && item.target.value.toLowerCase() == game.i18n.localize("You").toLowerCase()))
          game.wfrp4e.utility.applyEffectToTarget(effect, [{ actor: this.actor }]);
        else
          game.wfrp4e.utility.applyEffectToTarget(effect);
      });
      html.on("click", ".invoke-effect", async (ev) => {
        let effectId = ev.target.dataset["effectId"];
        let itemId = ev.target.dataset["itemId"];
        game.wfrp4e.utility.invokeEffect(this.actor, effectId, itemId);
      });
      html.on("mousedown", ".aoe-template", (ev) => {
        AOETemplate.fromString(ev.target.text).drawPreview(ev);
        this.minimize();
      });
    }
    _expandProperty(ev) {
      ev.preventDefault();
      let li = $(ev.currentTarget).parents(".item"), property = ev.target.text, properties = mergeObject(WFRP_Utility.qualityList(), WFRP_Utility.flawList()), propertyDescr = Object.assign(duplicate(game.wfrp4e.config.qualityDescriptions), game.wfrp4e.config.flawDescriptions);
      let item = this.actor.items.get(li.attr("data-item-id")).toObject();
      if (item) {
        let customProperties = item.system.qualities.value.concat(item.system.flaws.value).filter((i) => i.custom);
        customProperties.forEach((p) => {
          properties[p.key] = p.name;
          propertyDescr[p.key] = p.description;
        });
      }
      property = property.replace(/,/g, "").trim();
      let propertyKey = "";
      if (property == game.i18n.localize("Special Ammo")) {
        this.actor.items.get(li.attr("data-item-id")).toObject();
        let ammo = this.actor.items.get(item.system.currentAmmo.value).toObject();
        propertyDescr = Object.assign(
          propertyDescr,
          {
            [game.i18n.localize("Special Ammo")]: ammo.system.special.value
          }
        );
        propertyKey = game.i18n.localize("Special Ammo");
      } else if (property == "Special") {
        this.actor.items.get(li.attr("data-item-id"));
        propertyDescr = Object.assign(
          propertyDescr,
          {
            "Special": item.system.special.value
          }
        );
        propertyKey = "Special";
      } else {
        propertyKey = WFRP_Utility.findKey(WFRP_Utility.parsePropertyName(property), properties);
      }
      let propertyDescription = "<b>" + property + "</b>: " + propertyDescr[propertyKey];
      if (propertyDescription.includes("(Rating)"))
        propertyDescription = propertyDescription.replace("(Rating)", property.split(" ")[1]);
      if (li.hasClass("expanded")) {
        let summary = li.children(".item-summary");
        summary.slideUp(200, () => summary.remove());
      } else {
        let div = $(`<div class="item-summary">${propertyDescription}</div>`);
        li.append(div.hide());
        div.slideDown(200);
      }
      li.toggleClass("expanded");
    }
    _onSortClick(ev) {
      let type = ev.currentTarget.dataset.type;
      type = type.includes(",") ? type.split(",") : [type];
      let items = type.reduce((prev, current) => prev.concat(this.actor.getItemTypes(current).map((i) => i.toObject())), []);
      items = items.sort((a, b) => a.name < b.name ? -1 : 1);
      for (let i = 1; i < items.length; i++)
        items[i].sort = items[i - 1].sort + 1e4;
      return this.actor.updateEmbeddedDocuments("Item", items);
    }
    _expandInfo(ev) {
      ev.preventDefault();
      let li = $(ev.currentTarget).parents(".item");
      let classes = $(ev.currentTarget);
      let expansionText = "";
      let item = this.actor.items.get(li.attr("data-item-id"));
      if (classes.hasClass("weapon-range")) {
        if (!game.settings.get("wfrp4e", "mooRangeBands"))
          expansionText = `<a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Point Blank")}`].modifier}">${item.range.bands[`${game.i18n.localize("Point Blank")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Point Blank")}`].range[1]} ${game.i18n.localize("yds")}: ${game.wfrp4e.config.difficultyLabels[game.wfrp4e.config.rangeModifiers["Point Blank"]]}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Short Range")}`].modifier}">${item.range.bands[`${game.i18n.localize("Short Range")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Short Range")}`].range[1]} ${game.i18n.localize("yds")}: ${game.wfrp4e.config.difficultyLabels[game.wfrp4e.config.rangeModifiers["Short Range"]]}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Normal")}`].modifier}">${item.range.bands[`${game.i18n.localize("Normal")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Normal")}`].range[1]} ${game.i18n.localize("yds")}: ${game.wfrp4e.config.difficultyLabels[game.wfrp4e.config.rangeModifiers["Normal"]]}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Long Range")}`].modifier}">${item.range.bands[`${game.i18n.localize("Long Range")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Long Range")}`].range[1]} ${game.i18n.localize("yds")}: ${game.wfrp4e.config.difficultyLabels[game.wfrp4e.config.rangeModifiers["Long Range"]]}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Extreme")}`].modifier}">${item.range.bands[`${game.i18n.localize("Extreme")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Extreme")}`].range[1]} ${game.i18n.localize("yds")}: ${game.wfrp4e.config.difficultyLabels[game.wfrp4e.config.rangeModifiers["Extreme"]]}</a><br>
          `;
        else {
          game.wfrp4e.utility.logHomebrew("mooRangeBands");
          expansionText = `<a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Point Blank")}`].modifier}">${item.range.bands[`${game.i18n.localize("Point Blank")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Point Blank")}`].range[1]} ${game.i18n.localize("yds")}: ${item.range.bands[`${game.i18n.localize("Point Blank")}`].modifier}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Short Range")}`].modifier}">${item.range.bands[`${game.i18n.localize("Short Range")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Short Range")}`].range[1]} ${game.i18n.localize("yds")}: ${item.range.bands[`${game.i18n.localize("Short Range")}`].modifier}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Normal")}`].modifier}">${item.range.bands[`${game.i18n.localize("Normal")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Normal")}`].range[1]} ${game.i18n.localize("yds")}: ${item.range.bands[`${game.i18n.localize("Normal")}`].modifier}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Long Range")}`].modifier}">${item.range.bands[`${game.i18n.localize("Long Range")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Long Range")}`].range[1]} ${game.i18n.localize("yds")}: ${item.range.bands[`${game.i18n.localize("Long Range")}`].modifier}</a><br>
          <a class="range-click" data-range="${item.range.bands[`${game.i18n.localize("Extreme")}`].modifier}">${item.range.bands[`${game.i18n.localize("Extreme")}`].range[0]} ${game.i18n.localize("yds")} - ${item.range.bands[`${game.i18n.localize("Extreme")}`].range[1]} ${game.i18n.localize("yds")}: ${item.range.bands[`${game.i18n.localize("Extreme")}`].modifier}</a><br>
          `;
        }
      } else if (classes.hasClass("weapon-group")) {
        let weaponGroup = ev.target.text;
        let weaponGroupKey = "";
        weaponGroupKey = WFRP_Utility.findKey(weaponGroup, game.wfrp4e.config.weaponGroups);
        expansionText = game.wfrp4e.config.weaponGroupDescriptions[weaponGroupKey];
      } else if (classes.hasClass("weapon-reach")) {
        let reach = ev.target.text;
        let reachKey;
        reachKey = WFRP_Utility.findKey(reach, game.wfrp4e.config.weaponReaches);
        expansionText = game.wfrp4e.config.reachDescription[reachKey];
      }
      if (li.hasClass("expanded")) {
        let summary = li.children(".item-summary");
        summary.slideUp(200, () => summary.remove());
      } else {
        let div = $(`<div class="item-summary">${expansionText}</div>`);
        li.append(div.hide());
        div.slideDown(200);
        div.on("click", ".range-click", (ev2) => {
          let modifier = parseInt($(ev2.currentTarget).attr("data-range"));
          let weapon2 = item;
          if (weapon2)
            this.actor.setupWeapon(weapon2, { modify: { modifier } }).then((setupData) => {
              this.actor.weaponTest(setupData);
            });
        });
      }
      li.toggleClass("expanded");
    }
    duplicateItem(itemId) {
      let item = this.actor.items.get(itemId).toObject();
      this.actor.createEmbeddedDocuments("Item", [item]);
    }
    async splitItem(itemId, amount) {
      let item = this.actor.items.get(itemId).toObject();
      let newItem = duplicate(item);
      if (amount >= item.system.quantity.value)
        return ui.notifications.notify(game.i18n.localize("Invalid Quantity"));
      newItem.system.quantity.value = amount;
      item.system.quantity.value -= amount;
      await this.actor.createEmbeddedDocuments("Item", [newItem]);
      this.actor.updateEmbeddedDocuments("Item", [item]);
    }
    toggleItemCheckbox(itemId, target) {
      let item = this.actor.items.get(itemId);
      return item.update({ [`${target}`]: !getProperty(item, target) });
    }
  };

  // modules/hooks/actor.js
  function actor_default() {
    Hooks.on("updateActor", (actor) => {
    });
  }

  // modules/actor/sheet/character-sheet.js
  var ActorSheetWfrp4eCharacter = class extends ActorSheetWfrp4e {
    static get defaultOptions() {
      const options = super.defaultOptions;
      mergeObject(
        options,
        {
          classes: options.classes.concat(["wfrp4e", "actor", "character-sheet"]),
          width: 610,
          height: 740
        }
      );
      return options;
    }
    get template() {
      if (!game.user.isGM && this.actor.limited)
        return "systems/wfrp4e/templates/actors/actor-limited.html";
      return "systems/wfrp4e/templates/actors/character/character-sheet.html";
    }
    async getData() {
      const sheetData = await super.getData();
      this.addCharacterData(sheetData);
      return sheetData;
    }
    addCharacterData(sheetData) {
      sheetData.career = {
        untrainedSkills: [],
        untrainedTalents: [],
        currentClass: "",
        currentCareer: "",
        currentCareerGroup: "",
        status: "",
        hasCurrentCareer: false
      };
      for (let career of sheetData.actor.getItemTypes("career")) {
        if (career.current.value) {
          sheetData.career.hasCurrentCareer = true;
          sheetData.career.currentClass = career.class.value;
          sheetData.career.currentCareer = career.name;
          sheetData.career.currentCareerGroup = career.careergroup.value;
          if (!sheetData.actor.details.status.value)
            sheetData.career.status = game.wfrp4e.config.statusTiers[career.status.tier] + " " + career.status.standing;
          let availableCharacteristics = career.characteristics;
          for (let char in sheetData.system.characteristics) {
            if (availableCharacteristics.includes(char)) {
              sheetData.system.characteristics[char].career = true;
              if (sheetData.system.characteristics[char].advances >= career.level.value * 5) {
                sheetData.system.characteristics[char].complete = true;
              }
            }
          }
          for (let sk of career.skills) {
            let trainedSkill = sheetData.actor.getItemTypes("skill").find((s) => s.name.toLowerCase() == sk.toLowerCase());
            if (trainedSkill)
              trainedSkill._addCareerData(career);
            else
              sheetData.career.untrainedSkills.push(sk);
          }
          for (let talent of career.talents) {
            let trainedTalent = sheetData.actor.getItemTypes("talent").find((t) => t.name == talent);
            if (trainedTalent)
              trainedTalent._addCareerData(career);
            else
              sheetData.career.untrainedTalents.push(talent);
          }
        }
      }
      sheetData.system.details.experience.log.forEach((entry, i) => {
        entry.index = i;
      });
      sheetData.experienceLog = this._condenseXPLog(sheetData);
      sheetData.system.details.experience.canEdit = game.user.isGM || game.settings.get("wfrp4e", "playerExperienceEditing");
    }
    _condenseXPLog(sheetData) {
      let condensed = [];
      for (let logIndex = 0, lastPushed, lastPushedCounter = 0; logIndex < sheetData.system.details.experience.log.length; logIndex++) {
        let condense = false;
        if (lastPushed && lastPushed.type == sheetData.system.details.experience.log[logIndex].type && lastPushed.reason == sheetData.system.details.experience.log[logIndex].reason && (lastPushed.amount >= 0 && sheetData.system.details.experience.log[logIndex].amount >= 0 || lastPushed.amount <= 0 && sheetData.system.details.experience.log[logIndex].amount <= 0)) {
          condense = true;
        }
        if (condense) {
          lastPushed[lastPushed.type] = sheetData.system.details.experience.log[logIndex][lastPushed.type];
          lastPushed.amount += sheetData.system.details.experience.log[logIndex].amount;
          lastPushed.index = sheetData.system.details.experience.log[logIndex].index;
          lastPushed.spent = sheetData.system.details.experience.log[logIndex].spent;
          lastPushed.total = sheetData.system.details.experience.log[logIndex].total;
          lastPushed.counter++;
        } else {
          lastPushed = duplicate(sheetData.system.details.experience.log[logIndex]);
          lastPushed.counter = 1;
          condensed.push(lastPushed);
          lastPushedCounter = 0;
        }
      }
      for (let log of condensed) {
        if (log.counter && log.counter > 1)
          log.reason += ` (${log.counter})`;
      }
      return condensed.reverse();
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".career-toggle").click(this._onToggleCareer.bind(this));
      html.find(".add-career").click((ev) => {
        new game.wfrp4e.apps.CareerSelector(this.actor).render(true);
      });
      html.find(".untrained-skill").mousedown(this._onUntrainedSkillClick.bind(this));
      html.find(".untrained-talent").mousedown(this._onUntrainedTalentClick.bind(this));
      html.find(".advancement-indicator").mousedown(this._onAdvancementClick.bind(this));
      html.find(".exp-delete").click(this._onExpLogDelete.bind(this));
      html.find("#input-status").mousedown(this._onStatusClick.bind(this));
    }
    async _onToggleCareer(ev) {
      let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
      let type = $(ev.currentTarget).attr("toggle-type");
      let item = this.actor.items.get(itemId);
      if (type == "current" && item.current.value == false) {
        let updateCareers = this.actor.getItemTypes("career").map((i) => i.toObject());
        updateCareers.map((x) => x.system.current.value = false);
        await this.actor.updateEmbeddedDocuments("Item", updateCareers);
      }
      return item.update({ [`system.${type}.value`]: !item[type].value });
    }
    async _onUntrainedSkillClick(ev) {
      let skill = await WFRP_Utility.findSkill(event.target.text);
      if (ev.button == 2) {
        skill.sheet.render(true);
      } else {
        try {
          new Dialog(
            {
              title: game.i18n.localize("SHEET.AddSkillTitle"),
              content: `<p>${game.i18n.localize("SHEET.AddSkillPrompt")}</p>`,
              buttons: {
                yes: {
                  label: game.i18n.localize("Yes"),
                  callback: (dlg) => {
                    this.actor.createEmbeddedDocuments("Item", [skill.toObject()]);
                  }
                },
                cancel: {
                  label: game.i18n.localize("Cancel"),
                  callback: (dlg) => {
                    return;
                  }
                }
              },
              default: "yes"
            }
          ).render(true);
        } catch {
          console.error(error);
          ui.notifications.error(error);
        }
      }
    }
    async _onUntrainedTalentClick(ev) {
      let talent = await WFRP_Utility.findTalent(event.target.text);
      if (ev.button == 2) {
        talent.sheet.render(true);
      } else {
        try {
          new Dialog(
            {
              title: game.i18n.localize("SHEET.AddTalentTitle"),
              content: `<p>${game.i18n.localize("SHEET.AddTalentPrompt")}</p>`,
              buttons: {
                yes: {
                  label: game.i18n.localize("Yes"),
                  callback: (dlg) => {
                    try {
                      WFRP_Utility.checkValidAdvancement(this.actor.details.experience.total, this.actor.details.experience.spent + 100, game.i18n.localize("ACTOR.ErrorAdd"), talent.name);
                      this.actor.createEmbeddedDocuments("Item", [talent.toObject()]);
                      let expLog = duplicate(this.actor.details.experience.log || []);
                      expLog.push({ amount: 100, reason: talent.name, spent: this.actor.details.experience.spent + 100, total: this.actor.details.experience.total, type: "spent" });
                      ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: 100, reason: talent.name }));
                      this.actor.update(
                        {
                          "system.details.experience.spent": this.actor.details.experience.spent + 100,
                          "system.details.experience.log": expLog
                        }
                      );
                    } catch (error2) {
                      ui.notifications.error(error2);
                    }
                  }
                },
                yesNoExp: {
                  label: game.i18n.localize("Free"),
                  callback: (dlg) => {
                    this.actor.createEmbeddedDocuments("Item", [talent.toObject()]);
                  }
                },
                cancel: {
                  label: game.i18n.localize("Cancel"),
                  callback: (dlg) => {
                    return;
                  }
                }
              },
              default: "yes"
            }
          ).render(true);
        } catch {
          console.error(error);
          ui.notifications(error);
        }
      }
    }
    async _onAdvancementClick(ev) {
      let data = this.actor.toObject().system;
      let type = $(ev.target).attr("data-target");
      if (type == "skill") {
        let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
        let item = this.actor.items.get(itemId);
        if (ev.button == 0) {
          let cost = WFRP_Utility._calculateAdvCost(item.advances.value, type, item.advances.costModifier);
          try {
            WFRP_Utility.checkValidAdvancement(data.details.experience.total, data.details.experience.spent + cost, game.i18n.localize("ACTOR.ErrorImprove"), item.name);
            data.details.experience.spent = Number(data.details.experience.spent) + cost;
            await item.update({ "system.advances.value": item.advances.value + 1 });
            let expLog = this.actor._addToExpLog(cost, item.name, data.details.experience.spent);
            ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: cost, reason: item.name }));
            await this.actor.update({ "system.details.experience.spent": data.details.experience.spent, "system.details.experience.log": expLog });
          } catch (error2) {
            ui.notifications.error(error2);
          }
        } else if (ev.button = 2) {
          if (item.advances.value == 0)
            return;
          let cost = WFRP_Utility._calculateAdvCost(item.advances.value - 1, type, item.advances.costModifier);
          data.details.experience.spent = Number(data.details.experience.spent) - cost;
          await item.update({ "system.advances.value": item.advances.value - 1 });
          let expLog = this.actor._addToExpLog(-1 * cost, item.name, data.details.experience.spent);
          ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: -1 * cost, reason: item.name }));
          await this.actor.update({ "system.details.experience.spent": data.details.experience.spent, "system.details.experience.log": expLog });
        }
      } else if (type == "talent") {
        if (ev.button == 0) {
          let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
          let item = this.actor.items.get(itemId);
          let advances = item.Advances;
          let spent = 0;
          let cost = (advances + 1) * 100;
          try {
            WFRP_Utility.checkValidAdvancement(this.actor.details.experience.total, this.actor.details.experience.spent + cost, game.i18n.localize("ACTOR.ErrorImprove"), item.name);
            if (advances < item.Max || item.Max == "-") {
              spent = this.actor.details.experience.spent + cost;
            } else
              return;
            await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
            ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: cost, reason: item.name }));
            let expLog = this.actor._addToExpLog(cost, item.name, spent);
            await this.actor.update({ "system.details.experience.spent": spent, "system.details.experience.log": expLog });
          } catch (error2) {
            ui.notifications.error(error2);
          }
        } else if (ev.button == 2) {
          let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
          let item = this.actor.items.get(itemId);
          let advances = item.Advances;
          let spent = 0;
          let cost = advances * 100;
          spent = this.actor.details.experience.spent - cost;
          new Dialog(
            {
              title: game.i18n.localize("SHEET.RefundXPTitle"),
              content: `<p>${game.i18n.localize("SHEET.RefundXPPrompt")} (${advances * 100})</p>`,
              buttons: {
                yes: {
                  label: game.i18n.localize("Yes"),
                  callback: (dlg) => {
                    this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                    let expLog = this.actor._addToExpLog(-1 * cost, item.name, spent);
                    ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: -1 * cost, reason: item.name }));
                    this.actor.update({ "system.details.experience.spent": spent, "system.details.experience.log": expLog });
                  }
                },
                no: {
                  label: game.i18n.localize("No"),
                  callback: (dlg) => {
                    this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                  }
                },
                cancel: {
                  label: game.i18n.localize("Cancel"),
                  callback: (dlg) => {
                    return;
                  }
                }
              },
              default: "yes"
            }
          ).render(true);
        }
      } else {
        let characteristic = type;
        let currentChar = this.actor.characteristics[characteristic];
        if (ev.button == 0) {
          let cost = WFRP_Utility._calculateAdvCost(currentChar.advances, "characteristic");
          try {
            WFRP_Utility.checkValidAdvancement(data.details.experience.total, data.details.experience.spent + cost, game.i18n.localize("ACTOR.ErrorImprove"), game.wfrp4e.config.characteristics[characteristic]);
            data.characteristics[characteristic].advances++;
            data.details.experience.spent = Number(data.details.experience.spent) + cost;
            let expLog = this.actor._addToExpLog(cost, game.wfrp4e.config.characteristics[characteristic], data.details.experience.spent);
            ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: cost, reason: game.wfrp4e.config.characteristics[characteristic] }));
            data.details.experience.log = expLog;
            await this.actor.update({ "system.characteristics": data.characteristics, "system.details.experience": data.details.experience });
          } catch (error2) {
            ui.notifications.error(error2);
          }
        } else if (ev.button == 2) {
          if (currentChar.advances == 0)
            return;
          let cost = WFRP_Utility._calculateAdvCost(currentChar.advances - 1, "characteristic");
          data.characteristics[characteristic].advances--;
          data.details.experience.spent = Number(data.details.experience.spent) - cost;
          let expLog = this.actor._addToExpLog(-1 * cost, game.wfrp4e.config.characteristics[characteristic], data.details.experience.spent);
          ui.notifications.notify(game.i18n.format("ACTOR.SpentExp", { amount: -1 * cost, reason: game.wfrp4e.config.characteristics[characteristic] }));
          data.details.experience.log = expLog;
          await this.actor.update({ "system.characteristics": data.characteristics, "system.details.experience": data.details.experience });
        }
      }
    }
    _onExpLogDelete(ev) {
      let index = parseInt($(ev.currentTarget).parents(".exp-entry").attr("data-index"));
      let experience = duplicate(this.actor.details.experience);
      let entry = experience.log[index];
      let exp = parseInt(entry.amount);
      let type = entry.type;
      experience.log.splice(index, 1);
      new Dialog({
        title: game.i18n.localize("RevertExperience"),
        content: `<p>${game.i18n.localize("DIALOG.RevertExperience")}</p>`,
        buttons: {
          yes: {
            label: game.i18n.localize("Yes"),
            callback: (dlg) => {
              experience[type] -= exp;
              this.actor.update({ "system.details.experience": experience });
            }
          },
          no: {
            label: game.i18n.localize("No"),
            callback: (dlg) => {
              this.actor.update({ "system.details.experience": experience });
            }
          }
        }
      }).render(true);
    }
    _onStatusClick(ev) {
      let modifier = ev.button == 0 ? 1 : -1;
      this.actor.update({ "system.details.status.modifier": (this.actor.details.status.modifier || 0) + modifier });
    }
  };

  // modules/actor/sheet/npc-sheet.js
  var ActorSheetWfrp4eNPC = class extends ActorSheetWfrp4e {
    static get defaultOptions() {
      const options = super.defaultOptions;
      mergeObject(
        options,
        {
          classes: options.classes.concat(["wfrp4e", "actor", "npc-sheet"]),
          width: 610,
          height: 740
        }
      );
      return options;
    }
    get template() {
      if (!game.user.isGM && this.actor.limited)
        return "systems/wfrp4e/templates/actors/actor-limited.html";
      return "systems/wfrp4e/templates/actors/npc/npc-sheet.html";
    }
    activateListeners(html) {
      super.activateListeners(html);
      if (!this.options.editable)
        return;
      html.find(".ch-roll").click(this._onCharClick.bind(this));
      html.find(".npc-income").click(this._onNpcIncomeClick.bind(this));
      html.find(".npc-career").click(this._onNpcCareerClick.bind(this));
    }
    async _onNpcIncomeClick(event2) {
      let status = this.actor.details.status.value.split(" ");
      let dieAmount = game.wfrp4e.config.earningValues[WFRP_Utility.findKey(status[0], game.wfrp4e.config.statusTiers)][0];
      dieAmount = Number(dieAmount) * status[1];
      let moneyEarned;
      if (WFRP_Utility.findKey(status[0], game.wfrp4e.config.statusTiers) != "g") {
        dieAmount = dieAmount + "d10";
        moneyEarned = (await new Roll(dieAmount).roll()).total;
      } else
        moneyEarned = dieAmount;
      let paystring;
      switch (WFRP_Utility.findKey(status[0], game.wfrp4e.config.statusTiers)) {
        case "b":
          paystring = `${moneyEarned}${game.i18n.localize("MARKET.Abbrev.BP").toLowerCase()}.`;
          break;
        case "s":
          paystring = `${moneyEarned}${game.i18n.localize("MARKET.Abbrev.SS").toLowerCase()}.`;
          break;
        case "g":
          paystring = `${moneyEarned}${game.i18n.localize("MARKET.Abbrev.GC").toLowerCase()}.`;
          break;
      }
      let money = MarketWfrp4e.creditCommand(paystring, this.actor, { suppressMessage: true });
      WFRP_Audio.PlayContextAudio({ item: { type: "money" }, action: "gain" });
      this.actor.updateEmbeddedDocuments("Item", money);
    }
    async _onNpcCareerClick(event2) {
      event2.preventDefault();
      let id = $(event2.currentTarget).parents(".item").attr("data-item-id");
      let careerItem = this.actor.items.get(id);
      await careerItem.update({ "system.complete.value": !careerItem.complete.value });
      if (careerItem.complete.value) {
        new Dialog({
          content: game.i18n.localize("CAREERAdvHint"),
          title: game.i18n.localize("CAREERAdv"),
          buttons: {
            yes: {
              label: game.i18n.localize("Yes"),
              callback: async () => {
                await this.actor._advanceNPC(careerItem);
                await this.actor.update({ "system.details.status.value": game.wfrp4e.config.statusTiers[careerItem.status.tier] + " " + careerItem.status.standing });
              }
            },
            no: {
              label: game.i18n.localize("No"),
              callback: () => {
              }
            }
          }
        }).render(true);
      }
    }
  };
  Actors.registerSheet(
    "wfrp4e",
    ActorSheetWfrp4eNPC,
    {
      types: ["npc"],
      makeDefault: true
    }
  );

  // modules/actor/sheet/creature-sheet.js
  var ActorSheetWfrp4eCreature = class extends ActorSheetWfrp4e {
    dialogOpen = false;
    static get defaultOptions() {
      const options = super.defaultOptions;
      mergeObject(
        options,
        {
          classes: options.classes.concat(["wfrp4e", "actor", "creature-sheet"]),
          width: 610,
          height: 740
        }
      );
      return options;
    }
    get template() {
      if (!game.user.isGM && this.actor.limited)
        return "systems/wfrp4e/templates/actors/actor-limited.html";
      return "systems/wfrp4e/templates/actors/creature/creature-sheet.html";
    }
    async getData() {
      const sheetData = await super.getData();
      this.addCreatureData(sheetData);
      return sheetData;
    }
    addCreatureData(sheetData) {
      sheetData.items.skills.trained = sheetData.actor.getItemTypes("skill").filter((i) => i.advances.value > 0);
      sheetData.items.includedTraits = sheetData.items.traits.filter((i) => i.included);
    }
    _delayedDropdown(event2) {
      if (this.clicks)
        this.clicks++;
      else
        this.clicks = 1;
      if (this.clicks === 1) {
        this.timer = setTimeout(() => {
          this._onCreatureItemSummary(event2);
          this.clicks = 0;
        }, 250);
      } else {
        clearTimeout(this.timer);
        let itemId = $(event2.currentTarget).attr("data-item-id");
        const item = this.actor.items.get(itemId);
        item.sheet.render(true);
        this.clicks = 0;
      }
    }
    async _onCreatureItemSummary(event2) {
      event2.preventDefault();
      let li = $(event2.currentTarget).parent(".list"), item = this.actor.items.get($(event2.currentTarget).attr("data-item-id")), expandData = await item.getExpandData(
        {
          secrets: this.actor.isOwner
        }
      );
      if (li.hasClass("expanded")) {
        let summary = li.children(".item-summary");
        summary.slideUp(200, () => summary.remove());
      } else {
        let div = "";
        div = $(`<div class="item-summary"><b>${item.name}:</b>${expandData.description.value}</div>`);
        let props = $(`<div class="item-properties"></div>`);
        expandData.properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
        div.append(props);
        if (expandData.targetEffects.length) {
          let effectButtons = expandData.targetEffects.map((e) => `<a class="apply-effect" data-item-id=${item.id} data-effect-id=${e.id}>${game.i18n.format("SHEET.ApplyEffect", { effect: e.label })}</a>`);
          let effects = $(`<div>${effectButtons}</div>`);
          div.append(effects);
        }
        if (expandData.invokeEffects.length) {
          let effectButtons = expandData.invokeEffects.map((e) => `<a class="invoke-effect" data-item-id=${item.id} data-effect-id=${e.id}>${game.i18n.format("SHEET.InvokeEffect", { effect: e.label })}</a>`);
          let effects = $(`<div>${effectButtons}</div>`);
          div.append(effects);
        }
        li.append(div.hide());
        div.slideDown(200);
        this._dropdownListeners(div);
      }
      li.toggleClass("expanded");
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".content").hover((event2) => {
        if (!this.dialogOpen)
          $(event2.currentTarget).focus();
      });
      html.find(".content").keydown(this._onContentClick.bind(this));
      html.find(".creature-dropdown").mousedown((event2) => {
        this._delayedDropdown(event2);
      }).on("dblclick", function(e) {
        e.preventDefault();
      });
      if (!this.options.editable)
        return;
      html.find(".skills.name, .skills.total").mousedown(this._onCreatureSkillClick.bind(this));
      html.find(".traits.content").mousedown(this._onTraitClick.bind(this));
      html.find(".ch-roll").click(this._onCharClick.bind(this));
      html.find(".trait-include").mousedown(this._onTraitNameClick.bind(this));
    }
    _onContentClick(ev) {
      if (ev.keyCode == 46) {
        ev.preventDefault();
        ev.stopPropagation();
        let itemId = $(ev.currentTarget).attr("data-item-id");
        if (itemId)
          return this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      }
    }
    _onCreatureSkillClick(event2) {
      let newAdv;
      let advAmt;
      let skill = this.actor.items.get($(event2.currentTarget).parents(".content").attr("data-item-id"));
      if (event2.shiftKey || event2.ctrlKey) {
        if (event2.shiftKey)
          advAmt = 10;
        else if (event2.ctrlKey)
          advAmt = 1;
      }
      if (event2.button == 0) {
        if (advAmt) {
          skill.update({ "system.advances.value": newAdv });
        } else
          this.actor.setupSkill(skill).then((setupData) => {
            this.actor.basicTest(setupData);
          });
        ;
      } else if (event2.button == 2) {
        if (advAmt) {
          newAdv = skill.system.advances.value - advAmt;
          if (newAdv < 0)
            newAdv = 0;
          skill.update({ "system.advances.value": newAdv });
        } else {
          skill.sheet.render(true);
        }
      }
    }
    _onTraitClick(event2) {
      event2.preventDefault();
      this.dialogOpen = true;
      let trait = this.actor.items.get($(event2.currentTarget).attr("data-item-id"));
      if (event2.button == 2 || !trait.rollable.value) {
        this._delayedDropdown(event2);
        return;
      }
      this.actor.setupTrait(trait).then((testData) => {
        this.actor.traitTest(testData);
      }).finally(() => {
        this.dialogOpen = false;
      });
    }
    _onTraitNameClick(event2) {
      event2.preventDefault();
      let traitId = $(event2.currentTarget).parents(".item").attr("data-item-id");
      let included = false;
      if (event2.button == 0) {
        let newExcludedTraits = duplicate(this.actor.excludedTraits);
        if (this.actor.excludedTraits.includes(traitId)) {
          newExcludedTraits = newExcludedTraits.filter((i) => i != traitId);
          included = true;
        } else {
          newExcludedTraits.push(traitId);
          included = false;
        }
        return this.actor.update({ "system.excludedTraits": newExcludedTraits });
      } else if (event2.button == 2) {
        this._onItemSummary(event2);
      }
    }
  };

  // modules/actor/sheet/vehicle-sheet.js
  var ActorSheetWfrp4eVehicle = class extends ActorSheetWfrp4e {
    static get defaultOptions() {
      const options = super.defaultOptions;
      mergeObject(
        options,
        {
          classes: options.classes.concat(["wfrp4e", "actor", "vehicle-sheet"]),
          width: 610,
          height: 740,
          dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }, { dragSelector: ".actor-list .actor", dropSelector: null }]
        }
      );
      return options;
    }
    async _onDrop(event2) {
      let dragData = JSON.parse(event2.dataTransfer.getData("text/plain"));
      if (dragData?.type == "Actor") {
        let actor = await fromUuid(dragData.uuid);
        let passengers = duplicate(this.actor.system.passengers);
        passengers.push({ id: actor.id, count: 1 });
        this.actor.update({ "system.passengers": passengers });
      } else
        return super._onDrop(event2);
    }
    get template() {
      if (!game.user.isGM && this.actor.limited)
        return "systems/wfrp4e/templates/actors/actor-limited.html";
      return "systems/wfrp4e/templates/actors/vehicle/vehicle-sheet.html";
    }
    async getData() {
      let sheetData = await super.getData();
      sheetData.system.roles.forEach((r) => {
        if (r.actor) {
          r.img = game.actors.get(r.actor)?.data?.token?.img;
        }
      });
      return sheetData;
    }
    async _handleEnrichment() {
      let enrichment = {};
      enrichment["system.details.description.value"] = await TextEditor.enrichHTML(this.actor.system.details.description.value, { async: true });
      enrichment["system.details.gmnotes.value"] = await TextEditor.enrichHTML(this.actor.system.details.gmdescription.value, { async: true });
      return expandObject(enrichment);
    }
    _addEncumbranceData(sheetData) {
      sheetData.system.status.encumbrance.max = sheetData.system.status.carries.max;
      sheetData.system.status.encumbrance.pct = sheetData.system.status.encumbrance.over / sheetData.system.status.encumbrance.max * 100;
      sheetData.system.status.encumbrance.carryPct = sheetData.system.status.encumbrance.current / sheetData.system.status.carries.max * 100;
      if (sheetData.system.status.encumbrance.pct + sheetData.system.status.encumbrance.carryPct > 100) {
        sheetData.system.status.encumbrance.penalty = Math.floor((sheetData.system.status.encumbrance.carryPct + sheetData.system.status.encumbrance.pct - 100) / 10);
        sheetData.system.status.encumbrance.message = `Handling Tests suffer a -${sheetData.system.status.encumbrance.penalty} SL penalty.`;
        sheetData.system.status.encumbrance.overEncumbered = true;
      } else {
        sheetData.system.status.encumbrance.message = `Encumbrance below maximum: No Penalties`;
        if (sheetData.system.status.encumbrance.pct + sheetData.system.status.encumbrance.carryPct == 100 && sheetData.system.status.encumbrance.carryPct)
          sheetData.system.status.encumbrance.carryPct -= 1;
      }
      sheetData.system.status.encumbrance.total = sheetData.system.status.encumbrance.current + sheetData.system.status.encumbrance.over;
      sheetData.system.status.encumbrance.modMsg = game.i18n.format("VEHICLE.ModEncumbranceTT", { amt: sheetData.system.status.encumbrance.over }), sheetData.system.status.encumbrance.carryMsg = game.i18n.format("VEHICLE.CarryEncumbranceTT", { amt: Math.round(sheetData.system.status.encumbrance.current * 10) / 10 });
    }
    async passengerSelect(dialogMessage = game.i18n.localize("DIALOG.ActorSelection")) {
      return new Promise((resolve, reject2) => {
        renderTemplate("systems/wfrp4e/templates/dialog/vehicle-weapon.html", { dialogMessage, actors: this.actor.passengers.map((p) => p.actor) }).then((dlg) => {
          new Dialog({
            content: dlg,
            title: game.i18n.localize("DIALOG.ActorSelection"),
            buttons: {
              select: {
                label: game.i18n.localize("Select"),
                callback: (dlg2) => {
                  let actorId = dlg2.find("[name='actor']").val();
                  if (actorId)
                    resolve(game.actors.get(actorId));
                  reject2();
                }
              }
            }
          }).render(true);
        });
      });
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".passenger .name").click(this._onPassengerClick.bind(this));
      html.find(".role-skill").click(this._onRoleSkillClick.bind(this));
      html.find(".role-name").click(this._onRoleNameClick.bind(this));
      html.find(".vehicle-weapon-name").click(this._onVehicleWeaponClick.bind(this));
      if (!this.options.editable)
        return;
      html.find(".passenger-qty-click").mousedown(this._onPassengerQtyClick.bind(this));
      html.find(".passenger-delete-click").click(this._onPassengerDeleteClick.bind(this));
      html.find(".role-edit").mousedown(this._onRoleEditClick.bind(this));
      html.find(".role-actor").change(this._onRoleActorChange.bind(this));
      html.find(".role-input").change(this._onRoleInputChange.bind(this));
      html.find(".role-delete").click(this._onRoleDelete.bind(this));
      html.find(".cargo .inventory-list .name").mousedown(this._onCargoClick.bind(this));
    }
    _onPassengerClick(ev) {
      ev.stopPropagation();
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      game.actors.get(this.actor.passengers[index].actor.id).sheet.render(true);
    }
    async _onRoleSkillClick(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      if (ev.button == 0) {
        let { actor, test, testLabel, handling } = roles[index];
        actor = game.actors.get(actor);
        if (!actor)
          return ui.notifications.error(game.i18n.localize("VEHICLE.NoActor"));
        if (!actor.isOwner)
          return ui.notifications.error(game.i18n.localize("VEHICLE.TestNotPermitted"));
        let skill = actor.getItemTypes("skill").find((s) => s.name == test);
        let setupData;
        let title;
        if (testLabel)
          testLabel + " - " + test;
        if (!skill) {
          let char = game.wfrp4e.utility.findKey(test, game.wfrp4e.config.characteristics);
          if (!char)
            return ui.notifications.error(game.i18n.localize("VEHICLE.TestNotFound"));
          if (testLabel)
            title = testLabel + " - " + test;
          let prefill = this.actor.getPrefillData("characteristic", char, { vehicle: this.actor.id, handling });
          let penalty = this.actor.status.encumbrance.penalty || 0;
          if (handling)
            prefill.slBonus -= penalty;
          let modify = { modifier: prefill.testModifier, slBonus: prefill.slBonus, successBonus: prefill.successBonus };
          setupData = await actor.setupCharacteristic(char, { title, vehicle: this.actor.id, handling, modify });
        } else {
          if (testLabel)
            title = testLabel + " - " + test;
          let prefill = this.actor.getPrefillData("skill", skill, { vehicle: this.actor.id, handling });
          let penalty = this.actor.status.encumbrance.penalty || 0;
          if (handling)
            prefill.slBonus -= penalty;
          let modify = { modifier: prefill.testModifier, slBonus: prefill.slBonus, successBonus: prefill.successBonus };
          setupData = await actor.setupSkill(skill, { title, vehicle: this.actor.id, handling, modify });
        }
        actor.basicTest(setupData);
      }
    }
    _onRoleNameClick(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      let actor = game.actors.get(roles[index].actor);
      if (!actor)
        return ui.notifications.error(game.i18n.localize("VEHICLE.NoActor"));
      else
        actor.sheet.render(true);
    }
    async _onVehicleWeaponClick(ev) {
      event.preventDefault();
      let itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
      let weapon2 = this.actor.items.get(itemId);
      let vehicleSpeaker;
      if (this.isToken)
        vehicleSpeaker = {
          token: this.actor.token.id,
          scene: this.actor.token.parent.id
        };
      else
        vehicleSpeaker = {
          actor: this.actor.id
        };
      if (!game.user.isGM && game.user.character) {
        if (this.actor.passengers.find((p) => p.actor._id == game.user.character.id)) {
          game.user.character.setupWeapon(weapon2, { vehicle: vehicleSpeaker, ammo: this.actor.getItemTypes("ammunition") }).then((setupData) => {
            game.user.character.weaponTest(setupData);
          });
        }
      } else {
        let actor = await this.passengerSelect(game.i18n.localize("DIALOG.VehicleActorSelect"));
        if (!actor.isOwner)
          return ui.notifications.error(game.i18n.localize("VEHICLE.CantUseActor"));
        actor.setupWeapon(weapon2, { vehicle: vehicleSpeaker, ammo: this.actor.getItemTypes("ammunition") }).then((setupData) => {
          actor.weaponTest(setupData);
        });
      }
    }
    _onPassengerQtyClick(ev) {
      let multiplier = ev.button == 0 ? 1 : -1;
      multiplier = ev.ctrlKey ? multiplier * 10 : multiplier;
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let passengers = duplicate(this.actor.system.passengers);
      passengers[index].count += 1 * multiplier;
      passengers[index].count = passengers[index].count < 0 ? 0 : passengers[index].count;
      this.actor.update({ "system.passengers": passengers });
    }
    _onPassengerDeleteClick(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let passengers = duplicate(this.actor.system.passengers);
      passengers.splice(index, 1);
      this.actor.update({ "system.passengers": passengers });
    }
    _onRoleActorChange(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      roles[index].actor = ev.target.value;
      this.actor.update({ "system.roles": roles });
    }
    async _onRoleEditClick(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      let actor = this.actor;
      new Dialog({
        content: `
        <div class="form-group">
        <label style="min-width: 110px;">${game.i18n.localize("VEHICLE.EnterRoleName")}</label>

          <input name="role-name" type="text" value="${roles[index].name}"/>
        </div>
        
        <div class="form-group">
        <label style="min-width: 110px;">${game.i18n.localize("VEHICLE.RoleTest")}</label>
          <input name="role-test" type="text" placeholder="Skill or Characteristic" value="${roles[index].test}"/>
        </div>
        <div class="form-group">
        <label style="min-width: 110px;">${game.i18n.localize("VEHICLE.RoleTestLabel")}</label>
          <input name="role-test-label" type="text" value="${roles[index].testLabel}"/>
        </div>

        <div class="form-group">
        <label style="min-width: 110px;">${game.i18n.localize("VEHICLE.Handling")}</label>
          <input name="handling" type="checkbox" ${roles[index].handling ? "checked" : ""}/>
        </div>
        `,
        title: game.i18n.localize("VEHICLE.EnterRoleName"),
        buttons: {
          enter: {
            label: game.i18n.localize("Confirm"),
            callback: (dlg) => {
              let newName = dlg.find('[name="role-name"]').val();
              let newTest = dlg.find('[name="role-test"]').val();
              let newTestLabel = dlg.find('[name="role-test-label"]').val();
              let handling = dlg.find('[name="handling"]').is(":checked");
              roles[index].name = newName;
              roles[index].test = newTest;
              roles[index].testLabel = newTestLabel;
              roles[index].handling = handling;
              actor.update({ "system.roles": roles });
            }
          }
        },
        default: "enter"
      }).render(true);
    }
    _onRoleInputChange(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      roles[index].test = ev.target.value;
      this.actor.update({ "system.roles": roles });
    }
    _onRoleDelete(ev) {
      let index = Number($(ev.currentTarget).parents(".item").attr("data-index"));
      let roles = duplicate(this.actor.roles);
      roles.splice(index, 1);
      this.actor.update({ "system.roles": roles });
    }
    _onCargoClick(ev) {
      if (ev.button != 2)
        return;
      new Dialog({
        title: game.i18n.localize("SHEET.SplitTitle"),
        content: `<p>${game.i18n.localize("SHEET.SplitPrompt")}</p><div class="form-group"><input name="split-amt" type="text" /></div>`,
        buttons: {
          split: {
            label: "Split",
            callback: (dlg) => {
              let amt = Number(dlg.find('[name="split-amt"]').val());
              if (isNaN(amt))
                return;
              this.splitItem(this._getItemId(ev), amt);
            }
          }
        }
      }).render(true);
    }
  };
  Actors.registerSheet(
    "wfrp4e",
    ActorSheetWfrp4eVehicle,
    {
      types: ["vehicle"],
      makeDefault: true
    }
  );

  // modules/item/item-sheet.js
  var ItemSheetWfrp4e = class extends ItemSheet {
    constructor(item, options) {
      super(item, options);
      this.mce = null;
    }
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "description" }];
      options.scrollY = [".details"];
      return options;
    }
    _getHeaderButtons() {
      let buttons = super._getHeaderButtons();
      buttons.unshift(
        {
          class: "post",
          icon: "fas fa-comment",
          onclick: (ev) => this.item.postItem()
        }
      );
      return buttons;
    }
    async _render(force = false, options = {}) {
      await super._render(force, options);
      $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
      $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
      $(this._element).find(".post").attr("title", game.i18n.localize("SHEET.Post"));
      $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
    }
    get template() {
      let type = this.item.type;
      return `systems/wfrp4e/templates/items/item-${type}-sheet.html`;
    }
    async getData() {
      const data = await super.getData();
      data.system = data.item._source.system;
      if (this.item.type == "spell") {
        if (game.wfrp4e.config.magicLores[this.item.lore.value]) {
          data["loreValue"] = game.wfrp4e.config.magicLores[this.item.lore.value];
        } else {
          data["loreValue"] = this.item.lore.value;
        }
      }
      if (this.item.type == "weapon" && game.settings.get("wfrp4e", "mooRangeBands")) {
        game.wfrp4e.utility.logHomebrew("mooRangeBands");
        data.showOptimal = true;
      } else if (this.item.type == "career") {
        data["skills"] = this.item.system.skills.join(", ").toString();
        data["earningSkills"] = this.item.system.incomeSkill.map((skillIndex) => this.item.system.skills[skillIndex]);
        data["talents"] = this.item.system.talents.toString();
        data["trappings"] = this.item.system.trappings.toString();
        let characteristicList = duplicate(game.wfrp4e.config.characteristicsAbbrev);
        for (let char in characteristicList) {
          if (this.item.system.characteristics.includes(char))
            characteristicList[char] = {
              abrev: game.wfrp4e.config.characteristicsAbbrev[char],
              checked: true
            };
          else
            characteristicList[char] = {
              abrev: game.wfrp4e.config.characteristicsAbbrev[char],
              checked: false
            };
        }
        data["characteristicList"] = characteristicList;
      } else if (this.item.type == "cargo") {
        data.cargoTypes = game.wfrp4e.config.trade.cargoTypes;
        data.qualities = game.wfrp4e.config.trade.qualities;
        data["dotrActive"] = game.modules.get("wfrp4e-dotr") && game.modules.get("wfrp4e-dotr").active;
      }
      if (this.item.type == "critical" || this.item.type == "injury" || this.item.type == "disease" || this.item.type == "mutation")
        this.addConditionData(data);
      data.showBorder = data.item.img == "systems/wfrp4e/icons/blank.png" || !data.item.img;
      data.isOwned = this.item.isOwned;
      data.enrichment = await this._handleEnrichment();
      return data;
    }
    async _handleEnrichment() {
      let enrichment = {};
      enrichment["system.description.value"] = await TextEditor.enrichHTML(this.item.system.description.value, { async: true });
      enrichment["system.gmdescription.value"] = await TextEditor.enrichHTML(this.item.system.gmdescription.value, { async: true });
      return expandObject(enrichment);
    }
    addConditionData(data) {
      this.filterActiveEffects(data);
      data.conditions = duplicate(game.wfrp4e.config.statusEffects).filter((i) => i.id != "fear" && i.id != "grappling");
      delete data.conditions.splice(data.conditions.length - 1, 1);
      for (let condition of data.conditions) {
        let existing = data.item.conditions.find((e) => e.flags.core.statusId == condition.id);
        if (existing) {
          condition.value = existing.flags.wfrp4e.value;
          condition.existing = true;
        } else
          condition.value = 0;
        if (condition.flags.wfrp4e.value == null)
          condition.boolean = true;
      }
    }
    filterActiveEffects(data) {
      data.item.conditions = [];
      for (let e of this.item.effects) {
        e.data.sourcename = e.sourceName;
        let condId = e.getFlag("core", "statusId");
        if (condId && condId != "fear" && condId != "grappling")
          data.item.conditions.push(e.data);
      }
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find('input[type="checkbox"]').change((event2) => this._onSubmit(event2));
      html.find(".lore-input").change(this._onLoreChange.bind(this));
      html.find(".char-checkbox").click(this._onCharCheckboxClick.bind(this));
      html.find(".item-checkbox").click(this._onCheckboxClick.bind(this));
      html.find(".csv-input").change(this._onCSVInput.bind(this));
      html.find(".symptom-input").change(this._onSymptomChange.bind(this));
      html.find(".effect-create").click(this._onEffectCreate.bind(this));
      html.find(".effect-title").click(this._onEffectTitleClick.bind(this));
      html.find(".effect-delete").click(this._onEffectDelete.bind(this));
      html.find(".condition-value").mousedown(this._onConditionClick.bind(this));
      html.find(".condition-toggle").mousedown(this._onConditionToggle.bind(this));
      html.find(".edit-item-properties").click((ev) => {
        new game.wfrp4e.apps.ItemProperties(this.item).render(true);
      });
      html.find(".cargo-sell").click((ev) => {
        game.wfrp4e.apps.Wfrp4eTradeManager.processTradeSell(this.item);
      });
      html.on("click", ".chat-roll", WFRP_Utility.handleRollClick.bind(WFRP_Utility));
      html.on("click", ".symptom-tag", WFRP_Utility.handleSymptomClick.bind(WFRP_Utility));
      html.on("click", ".condition-chat", WFRP_Utility.handleConditionClick.bind(WFRP_Utility));
      html.on("mousedown", ".table-click", WFRP_Utility.handleTableClick.bind(WFRP_Utility));
      html.on("mousedown", ".pay-link", WFRP_Utility.handlePayClick.bind(WFRP_Utility));
      html.on("mousedown", ".credit-link", WFRP_Utility.handleCreditClick.bind(WFRP_Utility));
      html.on("mousedown", ".corruption-link", WFRP_Utility.handleCorruptionClick.bind(WFRP_Utility));
      html.on("mousedown", ".fear-link", WFRP_Utility.handleFearClick.bind(WFRP_Utility));
      html.on("mousedown", ".terror-link", WFRP_Utility.handleTerrorClick.bind(WFRP_Utility));
      html.on("mousedown", ".exp-link", WFRP_Utility.handleExpClick.bind(WFRP_Utility));
    }
    async _onLoreChange(event2) {
      if (!this.item.isOwned) {
        let loreEffects = this.item.effects.filter((i) => i.flags.wfrp4e.lore);
        await this.item.deleteEmbeddedDocuments("ActiveEffect", loreEffects.map((i) => i._id));
        let inputLore = event2.target.value;
        for (let lore in game.wfrp4e.config.magicLores) {
          if (inputLore == game.wfrp4e.config.magicLores[lore]) {
            this.item.createEmbeddedDocuments("ActiveEffect", [game.wfrp4e.config.loreEffects[lore]]);
            return this.item.update({ "data.lore.value": lore });
          }
        }
        return this.item.update({ "data.lore.value": inputLore });
      } else
        return ui.notifications.error(game.i18n.localize("ERROR.SpellLore"));
    }
    _onCharCheckboxClick(event2) {
      this._onSubmit(event2);
      let charChanged = $(event2.currentTarget).attr("name");
      let characteristicList = duplicate(this.item.characteristics);
      if (characteristicList.includes(charChanged))
        characteristicList.splice(characteristicList.findIndex((c) => c == charChanged));
      else
        characteristicList.push(charChanged);
      this.item.update({ "data.characteristics": characteristicList });
    }
    _onCheckboxClick(event2) {
      this._onSubmit(event2);
      let target = $(event2.currentTarget).attr("data-target");
      let data = this.item.toObject();
      setProperty(data, target, !getProperty(data, target));
      this.item.update(data);
    }
    async _onCSVInput(event2) {
      this._onSubmit(event2);
      let list = event2.target.value.split(",").map(function(item) {
        return item.trim();
      });
      switch (event2.target.attributes["data-dest"].value) {
        case "skills":
          {
            await this.item.update({ "data.skills": list });
          }
          break;
        case "earning":
          {
            this.item.update({ "data.incomeSkill": [] });
            let earningSkills = [];
            for (let sk in list) {
              let skillIndex = this.item.skills.indexOf(list[Number(sk)]);
              if (skillIndex == -1)
                continue;
              else
                earningSkills.push(skillIndex);
            }
            await this.item.update({ "data.incomeSkill": earningSkills });
          }
          break;
        case "talents":
          {
            await this.item.update({ "data.talents": list });
          }
          break;
        case "trappings":
          {
            await this.item.update({ "data.trappings": list });
          }
          break;
      }
    }
    async _onSymptomChange(event2) {
      let symptoms = event2.target.value.split(",").map((i) => i.trim());
      let symtomNames = symptoms.map((s) => {
        if (s.includes("("))
          return s.substring(0, s.indexOf("(") - 1);
        else
          return s;
      });
      let symptomKeys = symtomNames.map((s) => game.wfrp4e.utility.findKey(s, game.wfrp4e.config.symptoms));
      symptomKeys = symptomKeys.filter((s) => !!s);
      let symptomEffects = symptomKeys.map((s, i) => {
        if (game.wfrp4e.config.symptomEffects[s]) {
          let effect = duplicate(game.wfrp4e.config.symptomEffects[s]);
          effect.label = symptoms[i];
          return effect;
        }
      }).filter((i) => !!i);
      let effects = this.item.effects.map((i) => i.toObject()).filter((e) => getProperty(e, "flags.wfrp4e.symptom"));
      await this.item.deleteEmbeddedDocuments("ActiveEffect", effects.map((i) => i._id));
      await this.item.createEmbeddedDocuments("ActiveEffect", symptomEffects);
      this.item.update({ "system.symptoms.value": symptoms.join(", ") });
    }
    _onEffectCreate(ev) {
      if (this.item.isOwned)
        return ui.notifications.warn(game.i18n.localize("ERROR.AddEffect"));
      else
        this.item.createEmbeddedDocuments("ActiveEffect", [{ label: this.item.name, icon: this.item.img, transfer: !(this.item.type == "spell" || this.item.type == "prayer") }]);
    }
    _onEffectTitleClick(ev) {
      if (this.item.isOwned)
        return ui.notifications.warn(game.i18n.localize("ERROR.EditEffect"));
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      const effect = this.item.effects.find((i) => i.id == id);
      effect.sheet.render(true);
    }
    _onEffectDelete(ev) {
      let id = $(ev.currentTarget).parents(".item").attr("data-item-id");
      this.item.deleteEmbeddedDocuments("ActiveEffect", [id]);
    }
    _onConditionClick(ev) {
      let condKey = $(ev.currentTarget).parents(".sheet-condition").attr("data-cond-id");
      if (ev.button == 0)
        this.item.addCondition(condKey);
      else if (ev.button == 2)
        this.item.removeCondition(condKey);
    }
    _onConditionToggle(ev) {
      let condKey = $(ev.currentTarget).parents(".sheet-condition").attr("data-cond-id");
      if (game.wfrp4e.config.statusEffects.find((e) => e.id == condKey).flags.wfrp4e.value == null) {
        if (this.item.hasCondition(condKey))
          this.item.removeCondition(condKey);
        else
          this.item.addCondition(condKey);
        return;
      }
      if (ev.button == 0)
        this.item.addCondition(condKey);
      else if (ev.button == 2)
        this.item.removeCondition(condKey);
    }
  };
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(
    "wfrp4e",
    ItemSheetWfrp4e,
    {
      makeDefault: true
    }
  );

  // modules/apps/roll-dialog.js
  var RollDialog = class extends Dialog {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.resizable = true;
      return options;
    }
    updateValues(html) {
      let modifier = html.find('[name="testModifier"]')[0];
      let successBonus = html.find('[name="successBonus"]')[0];
      modifier.value = (this.userEntry.testModifier || 0) + (this.cumulativeBonuses.testModifier || 0) + (this.userEntry.calledShot || 0);
      if (!game.settings.get("wfrp4e", "mooAdvantage") && game.settings.get("wfrp4e", "autoFillAdvantage"))
        modifier.value = Number(modifier.value) + (game.settings.get("wfrp4e", "advantageBonus") * this.advantage || 0) || 0;
      successBonus.value = (this.userEntry.successBonus || 0) + (this.cumulativeBonuses.successBonus || 0);
      if (game.settings.get("wfrp4e", "mooAdvantage")) {
        successBonus.value = Number(successBonus.value) + Number(this.advantage || 0);
        WFRP_Utility.logHomebrew("mooAdvantage");
      }
      html.find('[name="slBonus"]')[0].value = (this.userEntry.slBonus || 0) + (this.cumulativeBonuses.slBonus || 0);
      let difficultySelect = html.find('[name="testDifficulty"]');
      difficultySelect.val(game.wfrp4e.utility.alterDifficulty(this.userEntry.difficulty, this.cumulativeBonuses.difficultyStep || 0));
    }
    changeAdvantage(advantage) {
      this.data.actor.update({ "system.status.advantage.value": advantage });
      ui.notifications.notify(game.i18n.localize("DIALOG.AdvantageUpdate"));
      this.advantage = advantage;
    }
    activateListeners(html) {
      super.activateListeners(html);
      this.userEntry = {};
      this.cumulativeBonuses = {};
      this.advantage = Number(html.find('[name="advantage"]').change((ev) => {
        let advantage = parseInt(ev.target.value);
        if (Number.isNumeric(advantage)) {
          this.changeAdvantage(advantage);
          this.updateValues(html);
        }
      }).val());
      html.find('[name="charging"]').change((ev) => {
        let onlyModifier = game.settings.get("wfrp4e", "useGroupAdvantage");
        if (ev.target.checked) {
          if (!onlyModifier && game.settings.get("wfrp4e", "capAdvantageIB")) {
            onlyModifier = this.advantage >= this.data.actor.characteristics.i.bonus;
          }
          onlyModifier ? this.userEntry.testModifier += 10 : this.changeAdvantage((this.advantage || 0) + 1);
        } else {
          onlyModifier ? this.userEntry.testModifier += -10 : this.changeAdvantage((this.advantage || 0) - 1);
        }
        html.find('[name="advantage"]')[0].value = this.advantage;
        this.updateValues(html);
      });
      html.find(".dialog-bonuses").change((ev) => {
        this.cumulativeBonuses = {
          testModifier: 0,
          successBonus: 0,
          slBonus: 0,
          difficultyStep: 0
        };
        ev.stopPropagation();
        $(ev.currentTarget).find("option").filter((o, option) => option.selected).each((o, option) => {
          if (option.dataset.modifier)
            this.cumulativeBonuses.testModifier += Number(option.dataset.modifier);
          if (option.dataset.successbonus)
            this.cumulativeBonuses.successBonus += Number(option.dataset.successbonus);
          if (option.dataset.slbonus)
            this.cumulativeBonuses.slBonus += Number(option.dataset.slbonus);
          if (option.dataset.difficultystep)
            this.cumulativeBonuses.difficultyStep += Number(option.dataset.difficultystep);
        });
        this.updateValues(html);
      });
      this.userEntry.testModifier = Number(html.find('[name="testModifier"]').change((ev) => {
        this.userEntry.testModifier = Number(ev.target.value);
        if (!game.settings.get("wfrp4e", "mooAdvantage") && game.settings.get("wfrp4e", "autoFillAdvantage"))
          this.userEntry.testModifier -= game.settings.get("wfrp4e", "advantageBonus") * this.advantage || 0 || 0;
        this.updateValues(html);
      }).val());
      this.userEntry.successBonus = Number(html.find('[name="successBonus"]').change((ev) => {
        this.userEntry.successBonus = Number(ev.target.value);
        if (game.settings.get("wfrp4e", "mooAdvantage"))
          this.userEntry.successBonus -= this.advantage || 0;
        this.updateValues(html);
      }).val());
      this.userEntry.slBonus = Number(html.find('[name="slBonus"]').change((ev) => {
        this.userEntry.slBonus = Number(ev.target.value);
        this.updateValues(html);
      }).val());
      this.userEntry.difficulty = html.find('[name="testDifficulty"]').change((ev) => {
        this.userEntry.difficulty = ev.target.value;
        this.updateValues(html);
      }).val();
      this.userEntry.calledShot = 0;
      this.selectedHitLocation = html.find('[name="selectedHitLocation"]').change((ev) => {
        if (ev.currentTarget.value && !["none", "roll"].includes(ev.currentTarget.value)) {
          if (!this.data.testData.deadeyeShot && !(this.data.testData.strikeToStun && this.selectedHitLocation.value == "head"))
            this.userEntry.calledShot = -20;
          else
            this.userEntry.calledShot = 0;
        } else {
          this.userEntry.calledShot = 0;
        }
        this.updateValues(html);
      })[0];
      if (!game.settings.get("wfrp4e", "mooAdvantage") && game.settings.get("wfrp4e", "autoFillAdvantage"))
        this.userEntry.testModifier -= game.settings.get("wfrp4e", "advantageBonus") * this.advantage || 0;
      else if (game.settings.get("wfrp4e", "mooAdvantage"))
        this.userEntry.successBonus -= this.advantage || 0;
    }
  };

  // modules/actor/actor-wfrp4e.js
  var ActorWfrp4e = class extends Actor {
    async _preCreate(data, options, user) {
      if (data._id)
        options.keepId = WFRP_Utility._keepID(data._id, this);
      await super._preCreate(data, options, user);
      let createData = {};
      if (!data.items?.length)
        createData.items = await this._getNewActorItems();
      else
        createData.items = this.items.map((i) => mergeObject(i.toObject(), game.wfrp4e.migration.migrateItemData(i), { overwrite: true }));
      if (data.effects?.length)
        createData.effects = this.effects.map((i) => mergeObject(i.toObject(), game.wfrp4e.migration.migrateEffectData(i), { overwrite: true }));
      mergeObject(createData, {
        "flags.autoCalcRun": true,
        "flags.autoCalcWalk": true,
        "flags.autoCalcWounds": true,
        "flags.autoCalcCritW": true,
        "flags.autoCalcCorruption": true,
        "flags.autoCalcEnc": true,
        "flags.autoCalcSize": true
      });
      if (!data.prototypeToken)
        mergeObject(
          createData,
          {
            "prototypeToken.bar1": { "attribute": "status.wounds" },
            "prototypeToken.bar2": { "attribute": "status.advantage" },
            "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.NEUTRAL,
            "prototypeToken.name": data.name
          }
        );
      else if (data.prototypeToken)
        createData.prototypeToken = data.prototypeToken;
      if (!data.img || data.img == "icons/svg/mystery-man.svg") {
        createData.img = "systems/wfrp4e/tokens/unknown.png";
        if (data.type == "vehicle")
          createData.img = "systems/wfrp4e/tokens/vehicle.png";
      }
      if (data.type == "character") {
        if (!createData.prototypeToken)
          createData.prototypeToken = {};
        createData.prototypeToken.vision = true;
        createData.prototypeToken.actorLink = true;
      }
      this.updateSource(createData);
    }
    async _preUpdate(updateData, options, user) {
      await super._preUpdate(updateData, options, user);
      if (!options.skipGroupAdvantage && hasProperty(updateData, "system.status.advantage.value") && game.settings.get("wfrp4e", "useGroupAdvantage")) {
        let combatant = game.combat?.getCombatantByActor(this.id);
        if (!combatant) {
          ui.notifications.notify(game.i18n.localize("GroupAdvantageNoCombatant"));
        } else if (!options.fromGroupAdvantage) {
          await WFRP_Utility.updateGroupAdvantage({ [`${this.advantageGroup}`]: updateData.system.status.advantage.value });
          if (game.user.isGM)
            delete updateData.system.status;
        }
      }
      this.handleScrollingText(updateData);
      if (this.prototypeToken?.texture?.src == "systems/wfrp4e/tokens/unknown.png" && updateData.img) {
        updateData["prototypeToken.texture.src"] = updateData.img;
      }
      if (hasProperty(updateData, "system.details.experience") && !hasProperty(updateData, "system.details.experience.log")) {
        let actorData = this.toObject();
        new Dialog({
          content: `<p>${game.i18n.localize("ExpChangeHint")}</p><div class="form-group"><input name="reason" type="text" /></div>`,
          title: game.i18n.localize("ExpChange"),
          buttons: {
            confirm: {
              label: game.i18n.localize("Confirm"),
              callback: (dlg) => {
              }
            }
          },
          default: "confirm",
          close: (dlg) => {
            let expLog = actorData.system.details.experience.log || [];
            let newEntry = { reason: dlg.find('[name="reason"]').val() };
            if (hasProperty(updateData, "system.details.experience.spent")) {
              newEntry.amount = updateData.system.details.experience.spent - actorData.system.details.experience.spent;
              newEntry.spent = updateData.system.details.experience.spent;
              newEntry.total = actorData.system.details.experience.total;
              newEntry.type = "spent";
            }
            if (hasProperty(updateData, "system.details.experience.total")) {
              newEntry.amount = updateData.system.details.experience.total - actorData.system.details.experience.total;
              newEntry.spent = actorData.system.details.experience.spent;
              newEntry.total = updateData.system.details.experience.total;
              newEntry.type = "total";
            }
            expLog.push(newEntry);
            this.update({ "system.details.experience.log": expLog });
          }
        }).render(true);
      }
    }
    handleScrollingText(data) {
      if (hasProperty(data, "system.status.wounds.value"))
        this._displayScrollingChange(getProperty(data, "system.status.wounds.value") - this.status.wounds.value);
      if (hasProperty(data, "system.status.advantage.value"))
        this._displayScrollingChange(getProperty(data, "system.status.advantage.value") - this.status.advantage.value, { advantage: true });
    }
    prepareBaseData() {
      for (let ch of Object.values(this.characteristics)) {
        ch.value = Math.max(0, ch.initial + ch.advances + (ch.modifier || 0));
        ch.bonus = Math.floor(ch.value / 10);
        ch.cost = WFRP_Utility._calculateAdvCost(ch.advances, "characteristic");
      }
      if (this.flags.autoCalcEnc && this.type != "vehicle")
        this.status.encumbrance.max = this.characteristics.t.bonus + this.characteristics.s.bonus;
      this.flags.meleeDamageIncrease = 0;
      this.flags.rangedDamageIncrease = 0;
      this.flags.robust = 0;
      this.flags.resolute = 0;
      this.flags.ambi = 0;
    }
    prepareData() {
      this.itemCategories = this.itemTypes;
      if (!this.img)
        this.img = CONST.DEFAULT_TOKEN;
      if (!this.name)
        this.name = "New " + this.documentName;
      this.prepareBaseData();
      this.prepareEmbeddedDocuments();
      this.runEffects("prePrepareData", { actor: this });
      this.prepareBaseData();
      this.prepareDerivedData();
      this.runEffects("prePrepareItems", { actor: this });
      this.prepareItems();
      if (this.type == "character")
        this.prepareCharacter();
      if (this.type == "npc")
        this.prepareNPC();
      if (this.type == "creature")
        this.prepareCreature();
      if (this.type == "vehicle")
        this.prepareVehicle();
      if (this.type != "vehicle") {
        this.prepareNonVehicle();
      }
      this.runEffects("prepareData", { actor: this });
      if (this.type != "vehicle") {
        if (game.actors && this.inCollection && game.user.isUniqueGM)
          this.checkSystemEffects();
      }
    }
    get actorEffects() {
      let actorEffects = new Collection();
      let effects = this.effects;
      effects.forEach((e) => {
        let effectApplication = e.application;
        let remove;
        try {
          if (e.origin && e.item) {
            let item = e.item;
            if (item.type == "disease") {
              if (!item.system.duration.active)
                remove = true;
            } else if (item.type == "spell" || item.type == "prayer") {
              remove = true;
            } else if (item.type == "trait" && this.type == "creature" && !item.included) {
              remove = true;
            } else if (effectApplication) {
              if (effectApplication == "equipped") {
                if (!item.isEquipped)
                  remove = true;
              } else if (effectApplication != "actor")
                remove = true;
            }
          } else {
            if (effectApplication == "apply")
              remove = true;
          }
          if (!remove)
            actorEffects.set(e.id, e);
        } catch (error2) {
          game.wfrp4e.utility.log(`The effect ${e.label} threw an error when being prepared. ${error2}`, e);
        }
      });
      return actorEffects;
    }
    get conditions() {
      return this.actorEffects.filter((e) => e.isCondition);
    }
    prepareNonVehicle() {
      if (this.type == "vehicle")
        return;
      if (this.flags.autoCalcWalk)
        this.details.move.walk = parseInt(this.details.move.value) * 2;
      if (this.flags.autoCalcRun)
        this.details.move.run = parseInt(this.details.move.value) * 4;
      if (!game.settings.get("wfrp4e", "useGroupAdvantage")) {
        if (game.settings.get("wfrp4e", "capAdvantageIB")) {
          this.status.advantage.max = this.characteristics.i.bonus;
          this.status.advantage.value = Math.clamped(this.status.advantage.value, 0, this.status.advantage.max);
        } else
          this.status.advantage.max = 10;
      }
      if (!hasProperty(this, "flags.autoCalcSize"))
        this.flags.autoCalcSize = true;
      let size;
      let trait = this.has(game.i18n.localize("NAME.Size"));
      if (trait)
        size = WFRP_Utility.findKey(trait.specification.value, game.wfrp4e.config.actorSizes);
      if (!size) {
        let smallTalent = this.has(game.i18n.localize("NAME.Small"), "talent");
        if (smallTalent)
          size = "sml";
        else
          size = "avg";
      }
      this.details.size.value = size || "avg";
      if (this.flags.autoCalcSize && game.actors) {
        let tokenData = this._getTokenSize();
        if (this.isToken) {
          this.token.updateSource(tokenData);
        } else if (canvas) {
          this.prototypeToken.updateSource(tokenData);
          this.getActiveTokens().forEach((t) => t.document.update(tokenData));
        }
      }
      this.checkWounds();
      if (this.isMounted && !game.actors) {
        game.wfrp4e.postReadyPrepare.push(this);
      } else if (this.isMounted && this.status.mount.isToken && !canvas) {
        game.wfrp4e.postReadyPrepare.push(this);
      } else if (this.isMounted) {
        let mount = this.mount;
        if (mount) {
          if (mount.status.wounds.value == 0)
            this.status.mount.mounted = false;
          else {
            this.details.move.value = mount.details.move.value;
            if (this.flags.autoCalcWalk)
              this.details.move.walk = mount.details.move.walk;
            if (this.flags.autoCalcRun)
              this.details.move.run = mount.details.move.run;
          }
        }
      }
    }
    prepareCharacter() {
      if (this.type != "character")
        return;
      let tb = this.characteristics.t.bonus;
      let wpb = this.characteristics.wp.bonus;
      if (this.flags.autoCalcCorruption) {
        this.status.corruption.max = tb + wpb;
      }
      let currentCareer = this.currentCareer;
      if (currentCareer) {
        let { standing, tier } = this._applyStatusModifier(currentCareer.status);
        this.details.status.standing = standing;
        this.details.status.tier = tier;
        this.details.status.value = game.wfrp4e.config.statusTiers[this.details.status.tier] + " " + this.details.status.standing;
      } else
        this.details.status.value = "";
      if (currentCareer) {
        let availableCharacteristics = currentCareer.characteristics;
        for (let char in this.characteristics) {
          if (availableCharacteristics.includes(char))
            this.characteristics[char].career = true;
        }
      }
      this.details.experience.current = this.details.experience.total - this.details.experience.spent;
    }
    prepareNPC() {
      if (this.type != "npc")
        return;
    }
    prepareCreature() {
      if (this.type != "creature")
        return;
    }
    prepareVehicle() {
      if (this.type != "vehicle")
        return;
    }
    async setupDialog({ dialogOptions, testData, cardOptions }) {
      let rollMode = game.settings.get("core", "rollMode");
      mergeObject(dialogOptions.data, testData);
      dialogOptions.data.difficultyLabels = game.wfrp4e.config.difficultyLabels;
      mergeObject(
        cardOptions,
        {
          user: game.user.id,
          sound: CONFIG.sounds.dice
        }
      );
      dialogOptions.data.rollMode = dialogOptions.data.rollMode || rollMode;
      if (CONFIG.Dice.rollModes)
        dialogOptions.data.rollModes = CONFIG.Dice.rollModes;
      else
        dialogOptions.data.rollModes = CONFIG.rollModes;
      dialogOptions.data.dialogEffects.map((e) => {
        let modifiers = [];
        if (e.modifier)
          modifiers.push(e.modifier + " " + game.i18n.localize("Modifier"));
        if (e.slBonus)
          modifiers.push(e.slBonus + " " + game.i18n.localize("DIALOG.SLBonus"));
        if (e.successBonus)
          modifiers.push(e.successBonus + " " + game.i18n.localize("DIALOG.SuccessBonus"));
        if (e.difficultyStep)
          modifiers.push(e.difficultyStep + " " + game.i18n.localize("DIALOG.DifficultyStep"));
        e.effectSummary = modifiers.join(", ");
      });
      testData.other = [];
      if (testData.options.context) {
        if (typeof testData.options.context.general === "string")
          testData.options.context.general = [testData.options.context.general];
        if (typeof testData.options.context.success === "string")
          testData.options.context.success = [testData.options.context.success];
        if (typeof testData.options.context.failure === "string")
          testData.options.context.failure = [testData.options.context.failure];
      }
      testData.targets = Array.from(game.user.targets).map((t) => t.document.actor.speakerData(t.document));
      if (canvas.scene)
        game.user.updateTokenTargets([]);
      testData.speaker = this.speakerData();
      if (!testData.options.bypass) {
        let html = await renderTemplate(dialogOptions.template, dialogOptions.data);
        return new Promise((resolve, reject2) => {
          new RollDialog(
            {
              title: dialogOptions.title,
              content: html,
              actor: this,
              testData,
              buttons: {
                rollButton: {
                  label: game.i18n.localize("Roll"),
                  callback: (html2) => resolve(dialogOptions.callback(html2))
                }
              },
              default: "rollButton"
            }
          ).render(true);
        });
      } else if (testData.options.bypass) {
        testData.testModifier = testData.options.testModifier || testData.testModifier;
        testData.slBonus = testData.options.slBonus || testData.slBonus;
        testData.successBonus = testData.options.successBonus || testData.successBonus;
        cardOptions.rollMode = testData.options.rollMode || rollMode;
        testData.rollMode = cardOptions.rollMode;
        testData.cardOptions = cardOptions;
        return new testData.rollClass(testData);
      }
      reject();
    }
    setupCharacteristic(characteristicId, options = {}) {
      let char = this.characteristics[characteristicId];
      let title = options.title || game.i18n.format("CharTest", { char: game.i18n.localize(char.label) });
      title += options.appendTitle || "";
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.CharacteristicTest,
        item: characteristicId,
        hitLocation: (characteristicId == "ws" || characteristicId == "bs") && !options.reload ? "roll" : "none",
        options,
        postFunction: "basicTest",
        hitLocationTable: game.wfrp4e.tables.getHitLocTable(game.user.targets.values().next().value?.actor.details.hitLocationTable.value || "hitloc"),
        deadeyeShot: this.has(game.i18n.localize("NAME.DeadeyeShot"), "talent") && characteristicId == "bs"
      };
      mergeObject(testData, this.getPrefillData("characteristic", characteristicId, options));
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/characteristic-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          advantage: this.status.advantage.value || 0,
          talents: this.getTalentTests(),
          rollMode: options.rollMode,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          testData.hitLocation = html.find('[name="selectedHitLocation"]').val();
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/characteristic-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupSkill(skill, options = {}) {
      if (typeof skill === "string") {
        let skillName = skill;
        skill = this.getItemTypes("skill").find((sk) => sk.name == skill);
        if (!skill) {
          skill = {
            name: skillName,
            id: "unknown",
            characteristic: {
              key: ""
            }
          };
        }
      }
      let title = options.title || game.i18n.format("SkillTest", { skill: skill.name });
      title += options.appendTitle || "";
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.SkillTest,
        income: options.income,
        item: skill.id,
        skillName: skill.name,
        options,
        postFunction: "basicTest",
        hitLocationTable: game.wfrp4e.tables.getHitLocTable(game.user.targets.values().next().value?.actor.details.hitLocationTable.value || "hitloc"),
        deadeyeShot: this.has(game.i18n.localize("NAME.DeadeyeShot"), "talent") && skill.characteristic.key == "bs"
      };
      mergeObject(testData, this.getPrefillData("skill", skill, options));
      if ((skill.characteristic.key == "ws" || skill.characteristic.key == "bs" || skill.name.includes(game.i18n.localize("NAME.Melee")) || skill.name.includes(game.i18n.localize("NAME.Ranged"))) && !options.reload) {
        testData.hitLocation = "roll";
      } else
        testData.hitLocation = "none";
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/skill-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          advantage: this.status.advantage.value || 0,
          talents: this.getTalentTests(),
          characteristicToUse: skill.characteristic.key,
          rollMode: options.rollMode,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          testData.characteristicToUse = html.find('[name="characteristicToUse"]').val();
          testData.hitLocation = html.find('[name="selectedHitLocation"]').val();
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/skill-card.html", title);
      if (options.corruption)
        cardOptions.rollMode = "gmroll";
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupWeapon(weapon2, options = {}) {
      let skillCharList = [];
      let title = options.title || game.i18n.localize("WeaponTest") + " - " + weapon2.name;
      title += options.appendTitle || "";
      if (!weapon2.id)
        weapon2 = new CONFIG.Item.documentClass(weapon2, { parent: this });
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.WeaponTest,
        hitLocation: "roll",
        item: weapon2.id || weapon2.toObject(),
        charging: options.charging || false,
        champion: !!this.has(game.i18n.localize("NAME.Champion")),
        riposte: !!this.has(game.i18n.localize("NAME.Riposte"), "talent"),
        infighter: !!this.has(game.i18n.localize("NAME.Infighter"), "talent"),
        resolute: this.flags.resolute || 0,
        options,
        postFunction: "weaponTest",
        hitLocationTable: game.wfrp4e.tables.getHitLocTable(game.user.targets.values().next().value?.actor.details.hitLocationTable.value || "hitloc"),
        deadeyeShot: this.has(game.i18n.localize("NAME.DeadeyeShot"), "talent") && weapon2.attackType == "ranged",
        strikeToStun: this.has(game.i18n.localize("NAME.StrikeToStun"), "talent") && weapon2.properties.qualities.pummel
      };
      if (weapon2.attackType == "melee")
        skillCharList.push({ char: true, key: "ws", name: game.i18n.localize("CHAR.WS") });
      else if (weapon2.attackType == "ranged") {
        skillCharList.push({ char: true, key: "bs", name: game.i18n.localize("CHAR.BS") });
        if (weapon2.consumesAmmo.value && weapon2.ammunitionGroup.value != "none" && weapon2.ammunitionGroup.value) {
          if (options.ammo)
            testData.ammo = options.ammo.find((a) => a.id == weapon2.currentAmmo.value);
          if (!testData.ammo)
            testData.ammo = this.items.get(weapon2.currentAmmo.value);
          if (!testData.ammo || !weapon2.currentAmmo.value || testData.ammo.quantity.value == 0) {
            AudioHelper.play({ src: `${game.settings.get("wfrp4e", "soundPath")}no.wav` }, false);
            ui.notifications.error(game.i18n.localize("ErrorNoAmmo"));
            return;
          }
        } else if (weapon2.consumesAmmo.value && weapon2.quantity.value == 0) {
          AudioHelper.play({ src: `${game.settings.get("wfrp4e", "soundPath")}no.wav` }, false);
          ui.notifications.error(game.i18n.localize("ErrorNoAmmo"));
          return;
        } else {
          testData.ammo = weapon2;
        }
        if (weapon2.loading && !weapon2.loaded.value) {
          this.rollReloadTest(weapon2);
          ui.notifications.notify(game.i18n.localize("ErrorNotLoaded"));
          return new Promise((resolve, reject2) => {
            resolve({ abort: true });
          });
        }
      }
      let defaultSelection;
      if (weapon2.skillToUse) {
        skillCharList.push(weapon2.skillToUse);
        defaultSelection = skillCharList.findIndex((i) => i.name == weapon2.skillToUse.name);
      }
      mergeObject(testData, this.getPrefillData("weapon", weapon2, options));
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/weapon-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          talents: this.getTalentTests(),
          skillCharList,
          defaultSelection,
          advantage: this.status.advantage.value || 0,
          rollMode: options.rollMode,
          chargingOption: this.showCharging(weapon2),
          dualWieldingOption: this.showDualWielding(weapon2),
          charging: testData.charging,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          testData.charging = html.find('[name="charging"]').is(":checked");
          testData.dualWielding = html.find('[name="dualWielding"]').is(":checked");
          testData.hitLocation = html.find('[name="selectedHitLocation"]').val();
          testData.cardOptions = cardOptions;
          if (this.isMounted && testData.charging) {
            cardOptions.title += " (Mounted)";
          }
          testData.skillSelected = skillCharList[Number(html.find('[name="skillSelected"]').val())];
          return new testData.rollClass(testData);
        }
      };
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/weapon-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupCast(spell, options = {}) {
      let title = options.title || game.i18n.localize("CastingTest") + " - " + spell.name;
      title += options.appendTitle || "";
      let castSkills = [{ char: true, key: "int", name: game.i18n.localize("CHAR.Int") }];
      let skill = spell.skillToUse;
      if (skill)
        castSkills.push(skill);
      let defaultSelection = castSkills.findIndex((i) => i.name == spell.skillToUse?.name);
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.CastTest,
        item: spell.id,
        malignantInfluence: false,
        options,
        postFunction: "castTest"
      };
      if (spell.damage.value)
        testData.hitLocation = true;
      mergeObject(testData, this.getPrefillData("cast", spell, options));
      testData.unofficialGrimoire = game.settings.get("wfrp4e", "unofficialgrimoire");
      let advantages = this.status.advantage.value || 0;
      if (testData.unofficialGrimoire) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        advantages = "N/A";
      } else {
        this.status.advantage.value || 0;
      }
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/spell-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          malignantInfluence: testData.malignantInfluence,
          talents: this.getTalentTests(),
          advantage: advantages,
          defaultSelection,
          castSkills,
          rollMode: options.rollMode,
          unofficialGrimoire: testData.unofficialGrimoire,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          if (testData.unofficialGrimoire) {
            game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
            testData.unofficialGrimoire = {};
            testData.unofficialGrimoire.ingredientMode = html.find('[name="ingredientTypeSelected"]').val();
            testData.unofficialGrimoire.overchannelling = Number(html.find('[name="overchannelling"]').val());
            testData.unofficialGrimoire.quickcasting = html.find('[name="quickcasting"]').is(":checked");
          }
          testData.skillSelected = castSkills[Number(html.find('[name="skillSelected"]').val())];
          testData.hitLocation = html.find('[name="hitLocation"]').is(":checked");
          testData.malignantInfluence = html.find('[name="malignantInfluence"]').is(":checked");
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      if (game.settings.get("wfrp4e", "mooMagicAdvantage")) {
        game.wfrp4e.utility.logHomebrew("mooMagicAdvantage");
        dialogOptions.data.advantage = "N/A";
      }
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/spell-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupChannell(spell, options = {}) {
      let title = options.title || game.i18n.localize("ChannellingTest") + " - " + spell.name;
      title += options.appendTitle || "";
      let channellSkills = [{ char: true, key: "wp", name: game.i18n.localize("CHAR.WP") }];
      let skills = this.getItemTypes("skill").filter((i) => i.name.toLowerCase().includes(game.i18n.localize("NAME.Channelling").toLowerCase()));
      if (skills.length)
        channellSkills = channellSkills.concat(skills);
      let spellLore = spell.lore.value;
      let defaultSelection;
      if (spell.wind && spell.wind.value) {
        defaultSelection = channellSkills.indexOf(channellSkills.find((x) => x.name.includes(spell.wind.value)));
        if (defaultSelection == -1) {
          let customChannellSkill = this.getItemTypes("skill").find((i) => i.name.toLowerCase().includes(spell.wind.value.toLowerCase()));
          if (customChannellSkill) {
            channellSkills.push(customChannellSkill);
            defaultSelection = channellSkills.length - 1;
          }
        }
      } else {
        defaultSelection = channellSkills.indexOf(channellSkills.find((x) => x.name.includes(game.wfrp4e.config.magicWind[spellLore])));
      }
      if (spellLore == "witchcraft")
        defaultSelection = channellSkills.indexOf(channellSkills.find((x) => x.name.toLowerCase().includes(game.i18n.localize("NAME.Channelling").toLowerCase())));
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.ChannelTest,
        item: spell.id,
        malignantInfluence: false,
        options,
        postFunction: "channelTest"
      };
      mergeObject(testData, this.getPrefillData("channelling", spell, options));
      testData.unofficialGrimoire = game.settings.get("wfrp4e", "unofficialgrimoire");
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/channel-dialog.html",
        data: {
          malignantInfluence: testData.malignantInfluence,
          channellSkills,
          defaultSelection,
          talents: this.getTalentTests(),
          advantage: "N/A",
          rollMode: options.rollMode,
          unofficialGrimoire: testData.unofficialGrimoire,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          if (testData.unofficialGrimoire) {
            game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
            testData.unofficialGrimoire = {};
            testData.unofficialGrimoire.ingredientMode = html.find('[name="ingredientTypeSelected"]').val();
          }
          testData.malignantInfluence = html.find('[name="malignantInfluence"]').is(":checked");
          testData.skillSelected = channellSkills[Number(html.find('[name="skillSelected"]').val())];
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      if (game.settings.get("wfrp4e", "mooMagicAdvantage")) {
        game.wfrp4e.utility.logHomebrew("mooMagicAdvantage");
        dialogOptions.data.advantage = this.status.advantage.value || 0;
      }
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/channel-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupPrayer(prayer, options = {}) {
      let title = options.title || game.i18n.localize("PrayerTest") + " - " + prayer.name;
      title += options.appendTitle || "";
      let praySkills = [{ char: true, key: "fel", name: game.i18n.localize("CHAR.Fel") }];
      let skill = this.getItemTypes("skill").find((i) => i.name.toLowerCase() == game.i18n.localize("NAME.Pray").toLowerCase());
      if (skill)
        praySkills.push(skill);
      let defaultSelection = praySkills.findIndex((i) => i.name.toLowerCase() == game.i18n.localize("NAME.Pray").toLowerCase());
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.PrayerTest,
        item: prayer.id,
        hitLocation: false,
        options,
        postFunction: "prayerTest"
      };
      if (prayer.damage.value || prayer.damage.dice || prayer.damage.addSL)
        testData.hitLocation = true;
      mergeObject(testData, this.getPrefillData("prayer", prayer, options));
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/prayer-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          talents: this.getTalentTests(),
          advantage: this.status.advantage.value || 0,
          praySkills,
          defaultSelection,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          testData.skillSelected = praySkills[Number(html.find('[name="skillSelected"]').val())];
          testData.hitLocation = html.find('[name="hitLocation"]').is(":checked");
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/prayer-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupTrait(trait, options = {}) {
      if (!trait.id)
        trait = new CONFIG.Item.documentClass(trait, { parent: this });
      if (!trait.rollable.value)
        return ui.notifications.notify("Non-rollable trait");
      let title = options.title || game.wfrp4e.config.characteristics[trait.rollable.rollCharacteristic] + ` ${game.i18n.localize("Test")} - ` + trait.name;
      title += options.appendTitle || "";
      let skill = this.getItemTypes("skill").find((sk) => sk.name == trait.rollable.skill);
      if (skill) {
        title = skill.name + ` ${game.i18n.localize("Test")} - ` + trait.name;
      }
      let testData = {
        title,
        rollClass: game.wfrp4e.rolls.TraitTest,
        item: trait.id || trait.toObject(),
        hitLocation: false,
        charging: options.charging || false,
        champion: !!this.has(game.i18n.localize("NAME.Champion")),
        options,
        postFunction: "traitTest",
        hitLocationTable: game.wfrp4e.tables.getHitLocTable(game.user.targets.values().next().value?.actor.details.hitLocationTable.value || "hitloc"),
        deadeyeShot: this.has(game.i18n.localize("NAME.DeadeyeShot"), "talent") && weapon.attackType == "ranged"
      };
      if (trait.rollable.rollCharacteristic == "ws" || trait.rollable.rollCharacteristic == "bs")
        testData.hitLocation = "roll";
      else
        testData.hitLocation = "none";
      mergeObject(testData, this.getPrefillData("trait", trait, options));
      let dialogOptions = {
        title,
        template: "/systems/wfrp4e/templates/dialog/skill-dialog.html",
        data: {
          hitLocation: testData.hitLocation,
          talents: this.getTalentTests(),
          chargingOption: this.showCharging(trait),
          charging: testData.charging,
          characteristicToUse: trait.rollable.rollCharacteristic,
          advantage: this.status.advantage.value || 0,
          dialogEffects: this.getDialogChoices()
        },
        callback: (html) => {
          cardOptions.rollMode = html.find('[name="rollMode"]').val();
          testData.rollMode = cardOptions.rollMode;
          testData.testModifier = Number(html.find('[name="testModifier"]').val());
          testData.testDifficulty = game.wfrp4e.config.difficultyModifiers[html.find('[name="testDifficulty"]').val()];
          testData.successBonus = Number(html.find('[name="successBonus"]').val());
          testData.slBonus = Number(html.find('[name="slBonus"]').val());
          testData.charging = html.find('[name="charging"]').is(":checked");
          testData.characteristicToUse = html.find('[name="characteristicToUse"]').val();
          testData.hitLocation = html.find('[name="selectedHitLocation"]').val();
          testData.cardOptions = cardOptions;
          return new testData.rollClass(testData);
        }
      };
      let cardOptions = this._setupCardOptions("systems/wfrp4e/templates/chat/roll/skill-card.html", title);
      return this.setupDialog({
        dialogOptions,
        testData,
        cardOptions
      });
    }
    setupExtendedTest(item, options = {}) {
      let defaultRollMode = item.hide.test || item.hide.progress ? "gmroll" : "roll";
      if (item.SL.target <= 0)
        return ui.notifications.error(game.i18n.localize("ExtendedError1"));
      options.extended = item.id;
      options.rollMode = defaultRollMode;
      options.hitLocation = false;
      let characteristic = WFRP_Utility.findKey(item.test.value, game.wfrp4e.config.characteristics);
      if (characteristic) {
        return this.setupCharacteristic(characteristic, options).then((setupData) => {
          this.basicTest(setupData);
        });
      } else {
        let skill = this.getItemTypes("skill").find((i) => i.name == item.test.value);
        if (skill) {
          return this.setupSkill(skill, options).then((setupData) => {
            this.basicTest(setupData);
          });
        }
        ui.notifications.error(`${game.i18n.format("ExtendedError2", { name: item.test.value })}`);
      }
    }
    _setupCardOptions(template, title) {
      let cardOptions = {
        speaker: {
          alias: this.token?.name || this.prototypeToken.name,
          actor: this.id
        },
        title,
        template,
        flags: { img: this.prototypeToken.randomImg ? this.img : this.prototypeToken.texture.src }
      };
      if (this.token) {
        cardOptions.speaker.alias = this.token.name;
        cardOptions.speaker.token = this.token.id;
        cardOptions.speaker.scene = canvas.scene.id;
        cardOptions.flags.img = this.token.texture.src;
        if (this.token.getFlag("wfrp4e", "mask")) {
          cardOptions.speaker.alias = "???";
          cardOptions.flags.img = "systems/wfrp4e/tokens/unknown.png";
        }
      } else {
        let speaker = ChatMessage.getSpeaker();
        if (speaker.actor == this.id) {
          cardOptions.speaker.alias = speaker.alias;
          cardOptions.speaker.token = speaker.token;
          cardOptions.speaker.scene = speaker.scene;
          cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token)?.document.texture.src : cardOptions.flags.img;
        }
        if (getProperty(this.prototypeToken, "flags.wfrp4e.mask")) {
          cardOptions.speaker.alias = "???";
          cardOptions.flags.img = "systems/wfrp4e/tokens/unknown.png";
        }
      }
      if (this.isMounted && this.mount) {
        cardOptions.flags.mountedImg = this.mount.prototypeToken.texture.src;
        cardOptions.flags.mountedName = this.mount.prototypeToken.name;
      }
      if (VideoHelper.hasVideoExtension(cardOptions.flags.img))
        game.video.createThumbnail(cardOptions.flags.img, { width: 50, height: 50 }).then((img) => cardOptions.flags.img = img);
      return cardOptions;
    }
    rollReloadTest(weapon2) {
      let testId = weapon2.getFlag("wfrp4e", "reloading");
      let extendedTest = this.items.get(testId);
      if (!extendedTest) {
        this.checkReloadExtendedTest(weapon2);
        return;
      }
      this.setupExtendedTest(extendedTest, { reload: true, weapon: weapon2, appendTitle: " - " + game.i18n.localize("ITEM.Reloading") });
    }
    async basicTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll({ async: true });
      return test;
    }
    async weaponTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll();
      return test;
    }
    async castTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll({ async: true });
      return test;
    }
    async channelTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll();
      return test;
    }
    async prayerTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll();
      return test;
    }
    async traitTest(test, options = {}) {
      if (test.testData)
        return ui.notifications.warn(game.i18n.localize("WARNING.ActorTest"));
      await test.roll();
      return test;
    }
    prepareItems() {
      const inContainers = [];
      for (let i of this.items) {
        i.prepareOwnedData();
        if (i.location && i.location.value && i.type != "critical" && i.type != "injury") {
          inContainers.push(i);
        } else if (i.encumbrance && i.type != "vehicleMod")
          this.status.encumbrance.current += Number(i.encumbrance.value);
      }
      this.computeEncumbrance();
      this.computeAP();
    }
    computeEncumbrance() {
      if (this.type != "vehicle") {
        this.status.encumbrance.current = Math.floor(this.status.encumbrance.current);
        this.status.encumbrance.state = this.status.encumbrance.current / this.status.encumbrance.max;
      } else if (this.type == "vehicle") {
        if (!game.actors)
          game.wfrp4e.postReadyPrepare.push(this);
        else {
          if (getProperty(this, "flags.actorEnc"))
            for (let passenger of this.passengers)
              this.status.encumbrance.current += passenger.enc;
        }
      }
      this.status.encumbrance.current = Math.floor(this.status.encumbrance.current);
      this.status.encumbrance.mods = this.getItemTypes("vehicleMod").reduce((prev, current) => prev + current.encumbrance.value, 0);
      this.status.encumbrance.over = this.status.encumbrance.mods - this.status.encumbrance.initial;
      this.status.encumbrance.over = this.status.encumbrance.over < 0 ? 0 : this.status.encumbrance.over;
      if (this.type == "vehicle") {
        this.status.encumbrance.max = this.status.carries.max;
        this.status.encumbrance.pct = this.status.encumbrance.over / this.status.encumbrance.max * 100;
        this.status.encumbrance.carryPct = this.status.encumbrance.current / this.status.carries.max * 100;
        if (this.status.encumbrance.pct + this.status.encumbrance.carryPct > 100) {
          this.status.encumbrance.penalty = Math.floor((this.status.encumbrance.carryPct + this.status.encumbrance.pct - 100) / 10);
        }
      }
    }
    computeAP() {
      const AP = {
        head: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Head"),
          show: true
        },
        body: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Body"),
          show: true
        },
        rArm: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Left Arm"),
          show: true
        },
        lArm: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Right Arm"),
          show: true
        },
        rLeg: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Right Leg"),
          show: true
        },
        lLeg: {
          value: 0,
          layers: [],
          label: game.i18n.localize("Left Leg"),
          show: true
        },
        shield: 0,
        shieldDamage: 0
      };
      this.getItemTypes("armour").filter((a) => a.isEquipped).forEach((a) => a._addAPLayer(AP));
      this.getItemTypes("weapon").filter((i) => i.properties.qualities.shield && i.isEquipped).forEach((i) => {
        AP.shield += i.properties.qualities.shield.value - Math.max(0, i.damageToItem.shield - Number(i.properties.qualities.durable?.value || 0));
        AP.shieldDamage += i.damageToItem.shield;
      });
      this.status.armour = AP;
    }
    _getTokenSize() {
      let tokenData = {};
      let tokenSize = game.wfrp4e.config.tokenSizes[this.details.size.value];
      if (tokenSize < 1) {
        tokenData.texture = { scaleX: tokenSize, scaleY: tokenSize };
        tokenData.width = 1;
        tokenData.height = 1;
      } else {
        tokenData.texture = { scaleX: 1, scaleY: 1 };
        tokenData.height = tokenSize;
        tokenData.width = tokenSize;
      }
      return tokenData;
    }
    checkWounds() {
      if (this.type != "vehicle" && this.flags.autoCalcWounds) {
        let wounds = this._calculateWounds();
        if (this.status.wounds.max != wounds) {
          if (this.compendium || !game.actors || !this.inCollection) {
            this.status.wounds.max = wounds;
            this.status.wounds.value = wounds;
          } else if (this.isOwner)
            this.update({ "system.status.wounds.max": wounds, "system.status.wounds.value": wounds });
        }
      }
    }
    async addBasicSkills() {
      let ownedBasicSkills = this.getItemTypes("skill").filter((i) => i.advanced.value == "bsc");
      let allBasicSkills = await WFRP_Utility.allBasicSkills();
      let skillsToAdd = allBasicSkills.filter((s) => !ownedBasicSkills.find((ownedSkill) => ownedSkill.name == s.name));
      this.createEmbeddedDocuments("Item", skillsToAdd);
    }
    _calculateWounds() {
      let sb = this.characteristics.s.bonus + (this.characteristics.s.calculationBonusModifier || 0);
      let tb = this.characteristics.t.bonus + (this.characteristics.t.calculationBonusModifier || 0);
      let wpb = this.characteristics.wp.bonus + (this.characteristics.wp.calculationBonusModifier || 0);
      let multiplier = {
        sb: 0,
        tb: 0,
        wpb: 0
      };
      if (this.flags.autoCalcCritW)
        this.status.criticalWounds.max = tb;
      let effectArgs = { sb, tb, wpb, multiplier, actor: this };
      this.runEffects("preWoundCalc", effectArgs);
      ({ sb, tb, wpb } = effectArgs);
      let wounds = this.status.wounds.max;
      if (this.flags.autoCalcWounds) {
        switch (this.details.size.value) {
          case "tiny":
            wounds = 1 + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb;
            break;
          case "ltl":
            wounds = tb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb;
            break;
          case "sml":
            wounds = 2 * tb + wpb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb;
            break;
          case "avg":
            wounds = sb + 2 * tb + wpb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb;
            break;
          case "lrg":
            wounds = 2 * (sb + 2 * tb + wpb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb);
            break;
          case "enor":
            wounds = 4 * (sb + 2 * tb + wpb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb);
            break;
          case "mnst":
            wounds = 8 * (sb + 2 * tb + wpb + tb * multiplier.tb + sb * multiplier.sb + wpb * multiplier.wpb);
            break;
        }
      }
      effectArgs = { wounds, actor: this };
      this.runEffects("woundCalc", effectArgs);
      wounds = effectArgs.wounds;
      return wounds;
    }
    applyDamage(opposedTest, damageType = game.wfrp4e.config.DAMAGE_TYPE.NORMAL) {
      if (!opposedTest.result.damage)
        return `<b>Error</b>: ${game.i18n.localize("CHAT.DamageAppliedError")}`;
      if (!opposedTest.result.damage.value)
        return game.i18n.localize("CHAT.DamageAppliedErrorTiring");
      let actor = this;
      let attacker = opposedTest.attacker;
      let soundContext = { item: {}, action: "hit" };
      let args = { actor, attacker, opposedTest, damageType };
      actor.runEffects("preTakeDamage", args);
      attacker.runEffects("preApplyDamage", args);
      damageType = args.damageType;
      let totalWoundLoss = opposedTest.result.damage.value;
      let newWounds = actor.status.wounds.value;
      let applyAP = damageType == game.wfrp4e.config.DAMAGE_TYPE.IGNORE_TB || damageType == game.wfrp4e.config.DAMAGE_TYPE.NORMAL;
      let applyTB = damageType == game.wfrp4e.config.DAMAGE_TYPE.IGNORE_AP || damageType == game.wfrp4e.config.DAMAGE_TYPE.NORMAL;
      let AP = actor.status.armour[opposedTest.result.hitloc.value];
      let updateMsg = `<b>${game.i18n.localize("CHAT.DamageApplied")}</b><span class = 'hide-option'>: `;
      let messageElements = [];
      let weaponProperties;
      let undamaging = false;
      let hack = false;
      let impale = false;
      let penetrating = false;
      let zzap = false;
      let pummel = false;
      if (applyTB) {
        totalWoundLoss -= actor.characteristics.t.bonus;
        messageElements.push(`${actor.characteristics.t.bonus} ${game.i18n.localize("TBRed")}`);
      }
      if (applyAP) {
        AP.ignored = 0;
        if (opposedTest.attackerTest.weapon) {
          weaponProperties = opposedTest.attackerTest.weapon.properties;
          penetrating = weaponProperties.qualities.penetrating;
          undamaging = weaponProperties.flaws.undamaging;
          hack = weaponProperties.qualities.hack;
          impale = weaponProperties.qualities.impale;
          pummel = weaponProperties.qualities.pummel;
          zzap = weaponProperties.qualities.zzap;
        }
        let ignorePartial = opposedTest.attackerTest.result.roll % 2 == 0 || opposedTest.attackerTest.result.critical;
        let ignoreWeakpoints = opposedTest.attackerTest.result.critical && impale;
        for (let layer of AP.layers) {
          if (ignoreWeakpoints && layer.weakpoints) {
            AP.ignored += layer.value;
          } else if (ignorePartial && layer.partial) {
            AP.ignored += layer.value;
          } else if (zzap && layer.metal) {
            AP.ignored += layer.value;
          } else if (penetrating) {
            if (!game.settings.get("wfrp4e", "mooPenetrating"))
              AP.ignored += layer.metal ? 1 : layer.value;
          }
          if (layer.value) {
            if (layer.armourType == "plate")
              soundContext.item.armourType = layer.armourType;
            else if (!soundContext.item.armourType || soundContext.item.armourType && soundContext.item.armourType.includes("leather") && layer.armourType == "mail")
              soundContext.item.armourType = layer.armourType;
            else if (!soundContext.item.armourType)
              soundContext.item.armourType = "leather";
          }
        }
        if (zzap) {
          AP.ignored += 1;
        }
        if (penetrating && game.settings.get("wfrp4e", "mooPenetrating")) {
          game.wfrp4e.utility.logHomebrew("mooPenetrating");
          AP.ignored += penetrating.value || 2;
        }
        AP.used = AP.value - AP.ignored;
        AP.used = AP.used < 0 ? 0 : AP.used;
        AP.used = undamaging ? AP.used * 2 : AP.used;
        if (AP.ignored)
          messageElements.push(`${AP.used}/${AP.value} ${game.i18n.localize("AP")}`);
        else
          messageElements.push(`${AP.used} ${game.i18n.localize("AP")}`);
        let shieldAP = 0;
        if (opposedTest.defenderTest.weapon) {
          if (opposedTest.defenderTest.weapon.properties.qualities.shield)
            shieldAP = opposedTest.defenderTest.weapon.properties.qualities.shield.value;
        }
        if (game.settings.get("wfrp4e", "mooShieldAP") && opposedTest.defenderTest.result.outcome == "failure") {
          game.wfrp4e.utility.logHomebrew("mooShieldAP");
          shieldAP = 0;
        }
        if (shieldAP)
          messageElements.push(`${shieldAP} ${game.i18n.localize("CHAT.DamageShield")}`);
        totalWoundLoss -= AP.used + shieldAP;
        if (!undamaging)
          totalWoundLoss = totalWoundLoss <= 0 ? 1 : totalWoundLoss;
        else
          totalWoundLoss = totalWoundLoss <= 0 ? 0 : totalWoundLoss;
        try {
          if (opposedTest.attackerTest.weapon.attackType == "melee") {
            if (opposedTest.attackerTest.weapon.Qualities.concat(opposedTest.attackerTest.weapon.Flaws).every((p) => [game.i18n.localize("PROPERTY.Pummel"), game.i18n.localize("PROPERTY.Slow"), game.i18n.localize("PROPERTY.Damaging")].includes(p)))
              soundContext.outcome = "warhammer";
            else if (AP.used) {
              soundContext.item.type = "armour";
              if (applyAP && totalWoundLoss <= 1)
                soundContext.outcome = "blocked";
              else if (applyAP)
                soundContext.outcome = "normal";
              if (impenetrable)
                soundContext.outcome = "impenetrable";
              if (hack)
                soundContext.outcome = "hack";
            } else {
              soundContext.item.type = "hit";
              soundContext.outcome = "normal";
              if (impale || penetrating) {
                soundContext.outcome = "normal_slash";
              }
            }
          }
        } catch (e) {
          WFRP_Utility.log("Sound Context Error: " + e, true);
        }
      }
      let scriptArgs = { actor, opposedTest, totalWoundLoss, AP, damageType, updateMsg, messageElements, attacker };
      actor.runEffects("takeDamage", scriptArgs);
      attacker.runEffects("applyDamage", scriptArgs);
      Hooks.call("wfrp4e:applyDamage", scriptArgs);
      let item = opposedTest.attackerTest.item;
      let itemDamageEffects = item.effects.filter((e) => e.application == "damage");
      for (let effect of itemDamageEffects) {
        try {
          let func = new Function("args", effect.script).bind({ actor, effect, item });
          func(scriptArgs);
        } catch (ex) {
          ui.notifications.error(game.i18n.format("ERROR.EFFECT", { effect: effect.label }));
          console.error("Error when running effect " + effect.label + " - If this effect comes from an official module, try replacing the actor/item from the one in the compendium. If it still throws this error, please use the Bug Reporter and paste the details below, as well as selecting which module and 'Effect Report' as the label.");
          console.error(`REPORT
-------------------
EFFECT:	${effect.label}
ACTOR:	${actor.name} - ${actor.id}
ERROR:	${ex}`);
        }
      }
      totalWoundLoss = scriptArgs.totalWoundLoss;
      newWounds -= totalWoundLoss;
      updateMsg += "</span>";
      updateMsg += " " + totalWoundLoss;
      updateMsg += ` (${messageElements.join(" + ")})`;
      WFRP_Audio.PlayContextAudio(soundContext);
      if (newWounds <= 0) {
        let critAmnt = game.settings.get("wfrp4e", "dangerousCritsMod");
        if (game.settings.get("wfrp4e", "dangerousCrits") && critAmnt && Math.abs(newWounds) - actor.characteristics.t.bonus > 0) {
          let critModifier = (Math.abs(newWounds) - actor.characteristics.t.bonus) * critAmnt;
          updateMsg += `<br><a class ="table-click critical-roll" data-modifier=${critModifier} data-table = "crit${opposedTest.result.hitloc.value}" ><i class='fas fa-list'></i> ${game.i18n.localize("Critical")} +${critModifier}</a>`;
        } else if (game.settings.get("wfrp4e", "mooCritModifiers")) {
          game.wfrp4e.utility.logHomebrew("mooCritModifiers");
          let critModifier = (Math.abs(newWounds) - actor.characteristics.t.bonus) * critAmnt;
          if (critModifier)
            updateMsg += `<br><a class ="table-click critical-roll" data-modifier=${critModifier} data-table = "crit${opposedTest.result.hitloc.value}" ><i class='fas fa-list'></i> ${game.i18n.localize("Critical")} ${critModifier > 0 ? "+" + critModifier : critModifier}</a>`;
          else
            updateMsg += `<br><a class ="table-click critical-roll" data-table = "crit${opposedTest.result.hitloc.value}" ><i class='fas fa-list'></i> ${game.i18n.localize("Critical")}</a>`;
        } else if (Math.abs(newWounds) < actor.characteristics.t.bonus)
          updateMsg += `<br><a class ="table-click critical-roll" data-modifier="-20" data-table = "crit${opposedTest.result.hitloc.value}" ><i class='fas fa-list'></i> ${game.i18n.localize("Critical")} (-20)</a>`;
        else
          updateMsg += `<br><a class ="table-click critical-roll" data-table = "crit${opposedTest.result.hitloc.value}" ><i class='fas fa-list'></i> ${game.i18n.localize("Critical")}</a>`;
      }
      if (hack)
        updateMsg += `<br>${game.i18n.localize("CHAT.DamageAP")} ${game.wfrp4e.config.locations[opposedTest.result.hitloc.value]}`;
      if (newWounds <= 0)
        newWounds = 0;
      if (item.type == "weapon" && item.properties.qualities.slash && updateMsg.includes("critical-roll")) {
        updateMsg += "<br><b>Slash Property</b>: Cause Bleeding on Critical Wounds";
      }
      let daemonicTrait = actor.has(game.i18n.localize("NAME.Daemonic"));
      let wardTrait = actor.has(game.i18n.localize("NAME.Ward"));
      if (daemonicTrait) {
        let daemonicRoll = Math.ceil(CONFIG.Dice.randomUniform() * 10);
        let target = daemonicTrait.specification.value;
        if (isNaN(target))
          target = target.split("").filter((char) => /[0-9]/.test(char)).join("");
        if (Number.isNumeric(target) && daemonicRoll >= parseInt(daemonicTrait.specification.value)) {
          updateMsg = `<span style = "text-decoration: line-through">${updateMsg}</span><br>${game.i18n.format("OPPOSED.Daemonic", { roll: daemonicRoll })}`;
          return updateMsg;
        } else if (Number.isNumeric(target)) {
          updateMsg += `<br>${game.i18n.format("OPPOSED.DaemonicRoll", { roll: daemonicRoll })}`;
        }
      }
      if (wardTrait) {
        let wardRoll = Math.ceil(CONFIG.Dice.randomUniform() * 10);
        let target = wardTrait.specification.value;
        if (isNaN(target))
          target = target.split("").filter((char) => /[0-9]/.test(char)).join("");
        if (Number.isNumeric(target) && wardRoll >= parseInt(wardTrait.specification.value)) {
          updateMsg = `<span style = "text-decoration: line-through">${updateMsg}</span><br>${game.i18n.format("OPPOSED.Ward", { roll: wardRoll })}`;
          return updateMsg;
        } else if (Number.isNumeric(target)) {
          updateMsg += `<br>${game.i18n.format("OPPOSED.WardRoll", { roll: wardRoll })}`;
        }
      }
      actor.update({ "system.status.wounds.value": newWounds });
      return updateMsg;
    }
    async applyBasicDamage(damage, { damageType = game.wfrp4e.config.DAMAGE_TYPE.NORMAL, minimumOne = true, loc = "body", suppressMsg = false } = {}) {
      let newWounds = this.status.wounds.value;
      let modifiedDamage = damage;
      let applyAP = damageType == game.wfrp4e.config.DAMAGE_TYPE.IGNORE_TB || damageType == game.wfrp4e.config.DAMAGE_TYPE.NORMAL;
      let applyTB = damageType == game.wfrp4e.config.DAMAGE_TYPE.IGNORE_AP || damageType == game.wfrp4e.config.DAMAGE_TYPE.NORMAL;
      let msg = game.i18n.format("CHAT.ApplyDamageBasic", { name: this.prototypeToken.name });
      if (applyAP) {
        modifiedDamage -= this.status.armour[loc].value;
        msg += ` (${this.status.armour[loc].value} ${game.i18n.localize("AP")}`;
        if (!applyTB)
          msg += ")";
        else
          msg += " + ";
      }
      if (applyTB) {
        modifiedDamage -= this.characteristics.t.bonus;
        if (!applyAP)
          msg += " (";
        msg += `${this.characteristics.t.bonus} ${game.i18n.localize("TBRed")})`;
      }
      if (minimumOne && modifiedDamage <= 0)
        modifiedDamage = 1;
      else if (modifiedDamage < 0)
        modifiedDamage = 0;
      msg = msg.replace("@DAMAGE", modifiedDamage);
      newWounds -= modifiedDamage;
      if (newWounds < 0)
        newWounds = 0;
      await this.update({ "system.status.wounds.value": newWounds });
      if (!suppressMsg)
        return ChatMessage.create({ content: msg });
      else
        return msg;
    }
    _displayScrollingChange(change, options = {}) {
      if (!change)
        return;
      change = Number(change);
      const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
      for (let t of tokens) {
        canvas.interface.createScrollingText(t.center, change.signedString(), {
          anchor: change < 0 ? CONST.TEXT_ANCHOR_POINTS.BOTTOM : CONST.TEXT_ANCHOR_POINTS.TOP,
          direction: change < 0 ? 1 : 2,
          fontSize: 30,
          fill: options.advantage ? "0x6666FF" : change < 0 ? "0xFF0000" : "0x00FF00",
          stroke: 0,
          strokeThickness: 4,
          jitter: 0.25
        });
      }
    }
    async _advanceSpeciesSkills() {
      let skillList;
      try {
        let { skills } = game.wfrp4e.utility.speciesSkillsTalents(this.details.species.value, this.details.species.subspecies);
        skillList = skills;
        if (!skillList) {
          throw game.i18n.localize("ErrorSpeciesSkills") + " " + this.details.species.value;
        }
      } catch (error2) {
        ui.notifications.info(`${game.i18n.format("ERROR.Species", { name: this.details.species.value })}`);
        WFRP_Utility.log("Could not find species " + this.details.species.value + ": " + error2, true);
        throw error2;
      }
      let skillSelector = new Roll(`1d${skillList.length}- 1`);
      await skillSelector.roll();
      let skillsSelected = [];
      while (skillsSelected.length < 6) {
        skillSelector = await skillSelector.reroll();
        if (!skillsSelected.includes(skillSelector.total))
          skillsSelected.push(skillSelector.total);
      }
      for (let skillIndex = 0; skillIndex < skillsSelected.length; skillIndex++) {
        if (skillIndex <= 2)
          await this._advanceSkill(skillList[skillsSelected[skillIndex]], 5);
        else
          await this._advanceSkill(skillList[skillsSelected[skillIndex]], 3);
      }
    }
    async _advanceSpeciesTalents() {
      let talentList;
      try {
        let { talents } = game.wfrp4e.utility.speciesSkillsTalents(this.details.species.value, this.details.species.subspecies);
        talentList = talents;
        if (!talentList) {
        }
      } catch (error2) {
        ui.notifications.info(`${game.i18n.format("ERROR.Species", { name: this.details.species.value })}`);
        WFRP_Utility.log("Could not find species " + this.details.species.value + ": " + error2, true);
        throw error2;
      }
      let talentSelector;
      for (let talent of talentList) {
        if (!isNaN(talent)) {
          for (let i = 0; i < talent; i++) {
            let result = await game.wfrp4e.tables.rollTable("talents");
            await this._advanceTalent(result.object.text);
          }
          continue;
        }
        let talentOptions = talent.split(",").map(function(item) {
          return item.trim();
        });
        if (talentOptions.length > 1) {
          talentSelector = await new Roll(`1d${talentOptions.length} - 1`).roll();
          await this._advanceTalent(talentOptions[talentSelector.total]);
        } else {
          await this._advanceTalent(talent);
        }
      }
    }
    async _advanceSkill(skillName, advances) {
      let existingSkill = this.has(skillName, "skill");
      if (existingSkill) {
        existingSkill = existingSkill.toObject();
        existingSkill.system.advances.value = existingSkill.system.advances.value < advances ? advances : existingSkill.system.advances.value;
        await this.updateEmbeddedDocuments("Item", [existingSkill]);
        return;
      }
      try {
        let skillToAdd = (await WFRP_Utility.findSkill(skillName)).toObject();
        skillToAdd.system.advances.value = advances;
        await this.createEmbeddedDocuments("Item", [skillToAdd]);
      } catch (error2) {
        console.error("Something went wrong when adding skill " + skillName + ": " + error2);
        ui.notifications.error(game.i18n.format("CAREER.AddSkillError", { skill: skillName, error: error2 }));
      }
    }
    async _advanceTalent(talentName) {
      try {
        let talent = await WFRP_Utility.findTalent(talentName);
        await this.createEmbeddedDocuments("Item", [talent.toObject()]);
      } catch (error2) {
        console.error("Something went wrong when adding talent " + talentName + ": " + error2);
        ui.notifications.error(game.i18n.format("CAREER.AddTalentError", { talent: talentName, error: error2 }));
      }
    }
    async _advanceNPC(careerData) {
      let updateObj = {};
      let advancesNeeded = careerData.level.value * 5;
      for (let advChar of careerData.characteristics)
        if (this.characteristics[advChar].advances < 5 * careerData.level.value)
          updateObj[`data.characteristics.${advChar}.advances`] = 5 * careerData.level.value;
      for (let skill of careerData.skills)
        await this._advanceSkill(skill, advancesNeeded);
      for (let talent of careerData.talents)
        await this._advanceTalent(talent);
      this.update(updateObj);
    }
    _replaceData(formula) {
      let dataRgx = new RegExp(/@([a-z.0-9]+)/gi);
      return formula.replace(dataRgx, (match, term) => {
        let value = getProperty(this, term);
        return value ? String(value).trim() : "0";
      });
    }
    useFortuneOnRoll(message2, type) {
      if (this.status.fortune.value > 0) {
        let test = message2.getTest();
        let html = `<h3 class="center"><b>${game.i18n.localize("FORTUNE.Use")}</b></h3>`;
        if (type == "reroll")
          html += `${game.i18n.format("FORTUNE.UsageRerollText", { character: "<b>" + this.name + "</b>" })}<br>`;
        else
          html += `${game.i18n.format("FORTUNE.UsageAddSLText", { character: "<b>" + this.name + "</b>" })}<br>`;
        html += `<b>${game.i18n.localize("FORTUNE.PointsRemaining")} </b>${this.status.fortune.value - 1}`;
        ChatMessage.create(WFRP_Utility.chatDataSetup(html));
        if (type == "reroll") {
          test.context.fortuneUsedReroll = true;
          test.context.fortuneUsedAddSL = true;
          test.reroll();
        } else {
          test.context.fortuneUsedAddSL = true;
          test.addSL(1);
        }
        this.update({ "system.status.fortune.value": this.status.fortune.value - 1 });
      }
    }
    useDarkDeal(message2) {
      let html = `<h3 class="center"><b>${game.i18n.localize("DARKDEAL.Use")}</b></h3>`;
      html += `${game.i18n.format("DARKDEAL.UsageText", { character: "<b>" + this.name + "</b>" })}<br>`;
      let corruption = Math.trunc(this.status.corruption.value) + 1;
      html += `<b>${game.i18n.localize("Corruption")}: </b>${corruption}/${this.status.corruption.max}`;
      ChatMessage.create(WFRP_Utility.chatDataSetup(html));
      this.update({ "system.status.corruption.value": corruption }).then(() => {
        this.checkCorruption();
      });
      let test = message2.getTest();
      test.reroll();
    }
    preparePostRollAction(message2) {
      let data = message2.flags.data;
      let cardOptions = {
        flags: { img: message2.flags.img },
        rollMode: data.rollMode,
        sound: message2.sound,
        speaker: message2.speaker,
        template: data.template,
        title: data.title.replace(` - ${game.i18n.localize("Opposed")}`, ""),
        user: message2.user
      };
      if (data.attackerMessage)
        cardOptions.attackerMessage = data.attackerMessage;
      if (data.defenderMessage)
        cardOptions.defenderMessage = data.defenderMessage;
      if (data.unopposedStartMessage)
        cardOptions.unopposedStartMessage = data.unopposedStartMessage;
      return cardOptions;
    }
    async corruptionDialog(strength) {
      new Dialog({
        title: game.i18n.localize("DIALOG.CorruptionTitle"),
        content: `<p>${game.i18n.format("DIALOG.CorruptionContent", { name: this.name })}</p>`,
        buttons: {
          endurance: {
            label: game.i18n.localize("NAME.Endurance"),
            callback: () => {
              let skill = this.getItemTypes("skill").find((i) => i.name == game.i18n.localize("NAME.Endurance"));
              if (skill) {
                this.setupSkill(skill, { title: game.i18n.format("DIALOG.CorruptionTestTitle", { test: skill.name }), corruption: strength }).then((setupData) => this.basicTest(setupData));
              } else {
                this.setupCharacteristic("t", { title: game.i18n.format("DIALOG.CorruptionTestTitle", { test: game.wfrp4e.config.characteristics["t"] }), corruption: strength }).then((setupData) => this.basicTest(setupData));
              }
            }
          },
          cool: {
            label: game.i18n.localize("NAME.Cool"),
            callback: () => {
              let skill = this.getItemTypes("skill").find((i) => i.name == game.i18n.localize("NAME.Cool"));
              if (skill) {
                this.setupSkill(skill, { title: game.i18n.format("DIALOG.CorruptionTestTitle", { test: skill.name }), corruption: strength }).then((setupData) => this.basicTest(setupData));
              } else {
                this.setupCharacteristic("wp", { title: game.i18n.format("DIALOG.CorruptionTestTitle", { test: game.wfrp4e.config.characteristics["wp"] }), corruption: strength }).then((setupData) => this.basicTest(setupData));
              }
            }
          }
        }
      }).render(true);
    }
    has(traitName, type = "trait") {
      return this.getItemTypes(type).find((i) => i.name == traitName && i.included);
    }
    getDialogChoices() {
      let effects = this.actorEffects.filter((e) => e.trigger == "dialogChoice" && !e.disabled).map((e) => {
        return e.prepareDialogChoice();
      });
      let dedupedEffects = [];
      effects.forEach((e) => {
        let existing = dedupedEffects.find((ef) => ef.description == e.description);
        if (existing) {
          existing.modifier += e.modifier;
          existing.slBonus += e.slBonus;
          existing.successBonus += e.successBonus;
        } else
          dedupedEffects.push(e);
      });
      return dedupedEffects;
    }
    getTalentTests() {
      let talents = this.getItemTypes("talent").filter((t) => t.tests.value);
      let noDups = [];
      for (let t of talents) {
        if (!noDups.find((i) => i.name == t.name))
          noDups.push(t);
      }
      return noDups;
    }
    getPrefillData(type, item, options = {}) {
      let modifier = 0, difficulty = "challenging", slBonus = 0, successBonus = 0;
      let tooltip = [];
      try {
        if (game.settings.get("wfrp4e", "testDefaultDifficulty") && game.combat != null)
          difficulty = game.combat.started ? "challenging" : "average";
        else if (game.settings.get("wfrp4e", "testDefaultDifficulty"))
          difficulty = "average";
        if (this.type != "vehicle") {
          let addAdvantage = true;
          if (type == "channelling")
            addAdvantage = false;
          if (type == "channelling" && game.settings.get("wfrp4e", "mooMagicAdvantage"))
            addAdvantage = true;
          if (type == "cast" && game.settings.get("wfrp4e", "mooMagicAdvantage"))
            addAdvantage = false;
          if (addAdvantage) {
            if (!game.settings.get("wfrp4e", "mooAdvantage")) {
              modifier += game.settings.get("wfrp4e", "autoFillAdvantage") ? this.status.advantage.value * game.settings.get("wfrp4e", "advantageBonus") || 0 : 0;
              if (parseInt(this.status.advantage.value) && game.settings.get("wfrp4e", "autoFillAdvantage"))
                tooltip.push(game.i18n.localize("Advantage"));
            } else if (game.settings.get("wfrp4e", "mooAdvantage")) {
              successBonus += game.settings.get("wfrp4e", "autoFillAdvantage") ? this.status.advantage.value * 1 || 0 : 0;
              if (parseInt(this.status.advantage.value) && game.settings.get("wfrp4e", "autoFillAdvantage"))
                tooltip.push(game.i18n.localize("Advantage"));
            }
          }
          if (type == "characteristic") {
            if (options.dodge && this.isMounted) {
              modifier -= 20;
              tooltip.push(game.i18n.localize("EFFECT.DodgeMount"));
            }
          }
          if (type == "skill") {
            if (item.name == game.i18n.localize("NAME.Dodge") && this.isMounted) {
              modifier -= 20;
              tooltip.push(game.i18n.localize("EFFECT.DodgeMount"));
            }
          }
          if (options.corruption || options.mutate)
            difficulty = "challenging";
          if (options.rest || options.income)
            difficulty = "average";
        }
        let attacker = this.attacker;
        if (attacker && attacker.test.weapon && attacker.test.weapon.properties.flaws.slow) {
          if (!game.settings.get("wfrp4e", "mooQualities") || (type == "skill" && item.name == game.i18n.localize("NAME.Dodge") || type == "characteristic" && options.dodge)) {
            slBonus += 1;
            tooltip.push(game.i18n.localize("CHAT.TestModifiers.SlowDefend"));
          }
        }
        if (type == "weapon" || type == "trait") {
          let { wepModifier, wepSuccessBonus, wepSLBonus } = this.weaponPrefillData(item, options, tooltip);
          modifier += wepModifier;
          slBonus += wepSLBonus;
          successBonus += wepSuccessBonus;
        }
        if (type == "weapon" || type == "trait") {
          let { sizeModifier, sizeSuccessBonus, sizeSLBonus } = this.sizePrefillModifiers(item, type, options, tooltip);
          modifier += sizeModifier;
          slBonus += sizeSLBonus;
          successBonus += sizeSuccessBonus;
        }
        modifier += this.armourPrefillModifiers(item, type, options, tooltip);
        if (type == "trait")
          difficulty = item.rollable.defaultDifficulty || difficulty;
        if (options.modify) {
          modifier = modifier += options.modify.modifier || 0;
          slBonus = slBonus += options.modify.slBonus || 0;
          successBonus = successBonus += options.modify.successBonus || 0;
          if (options.modify.difficulty)
            difficulty = game.wfrp4e.utility.alterDifficulty(difficulty, options.modify.difficulty);
        }
        let effectModifiers = { modifier, difficulty, slBonus, successBonus };
        let effects = this.runEffects("prefillDialog", { prefillModifiers: effectModifiers, type, item, options });
        tooltip = tooltip.concat(effects.map((e) => e.label));
        if (game.user.targets.size) {
          effects = this.runEffects("targetPrefillDialog", { prefillModifiers: effectModifiers, type, item, options });
          tooltip = tooltip.concat(effects.map((e) => game.i18n.localize("EFFECT.Target") + e.label));
        }
        modifier = effectModifiers.modifier;
        difficulty = effectModifiers.difficulty;
        slBonus = effectModifiers.slBonus;
        successBonus = effectModifiers.successBonus;
        if (options.absolute) {
          modifier = options.absolute.modifier || modifier;
          difficulty = options.absolute.difficulty || difficulty;
          slBonus = options.absolute.slBonus || slBonus;
          successBonus = options.absolute.successBonus || successBonus;
        }
      } catch (e) {
        ui.notifications.error("Something went wrong with applying general modifiers: " + e);
        slBonus = 0;
        successBonus = 0;
        modifier = 0;
      }
      return {
        testModifier: modifier,
        testDifficulty: difficulty,
        slBonus,
        successBonus,
        prefillTooltip: game.i18n.localize("EFFECT.Tooltip") + "\n" + tooltip.map((t) => t.trim()).join("\n")
      };
    }
    weaponPrefillData(item, options, tooltip = []) {
      let slBonus = 0;
      let successBonus = 0;
      let modifier = 0;
      if (item.type == "weapon" && item.offhand.value && !item.twohanded.value && !(item.weaponGroup.value == "parry" && item.properties.qualities.defensive)) {
        modifier = -20;
        tooltip.push(game.i18n.localize("SHEET.Offhand"));
        modifier += Math.min(20, this.flags.ambi * 10);
        if (this.flags.ambi)
          tooltip.push(game.i18n.localize("NAME.Ambi"));
      }
      try {
        let target = game.user.targets.size ? Array.from(game.user.targets)[0].actor : void 0;
        let attacker = this.attacker;
        if (this.defensive && attacker) {
          tooltip.push(game.i18n.localize("PROPERTY.Defensive"));
          slBonus += this.defensive;
        }
        if (attacker && attacker.test.item.type == "weapon" && attacker.test.item.properties.qualities.fast && item.attackType == "melee" && (item.type == "trait" || item.type == "weapon" && !item.properties.qualities.fast)) {
          tooltip.push(game.i18n.localize("CHAT.TestModifiers.FastWeapon"));
          modifier += -10;
        }
        if (item.type == "weapon") {
          if (item.properties.qualities.accurate) {
            modifier += 10;
            tooltip.push(game.i18n.localize("PROPERTY.Accurate"));
          }
          if (item.properties.qualities.precise && game.user.targets.size) {
            successBonus += 1;
            tooltip.push(game.i18n.localize("PROPERTY.Precise"));
          }
          if (item.properties.flaws.imprecise && game.user.targets.size) {
            slBonus -= 1;
            tooltip.push(game.i18n.localize("PROPERTY.Imprecise"));
          }
          if (attacker && item.properties.flaws.unbalanced) {
            slBonus -= 1;
            tooltip.push(game.i18n.localize("PROPERTY.Unbalanced"));
          }
        }
        if (attacker && attacker.test.item.type == "weapon" && attacker.test.item.properties.qualities.wrap) {
          slBonus -= 1;
          tooltip.push(game.i18n.localize("CHAT.TestModifiers.WrapDefend"));
        }
        modifier += this.rangePrefillModifiers(item, options, tooltip);
      } catch (e) {
        ui.notifications.error("Something went wrong with applying weapon modifiers: " + e);
        slBonus = 0;
        successBonus = 0;
        modifier = 0;
      }
      return {
        wepModifier: modifier,
        wepSuccessBonus: successBonus,
        wepSLBonus: slBonus
      };
    }
    rangePrefillModifiers(weapon2, options, tooltip = []) {
      let modifier = 0;
      let token;
      if (this.isToken)
        token = this.token;
      else
        token = this.getActiveTokens()[0]?.document;
      if (!game.settings.get("wfrp4e", "rangeAutoCalculation") || !token || !game.user.targets.size == 1 || !weapon2.range?.bands)
        return 0;
      let target = Array.from(game.user.targets)[0].document;
      let distance = canvas.grid.measureDistances([{ ray: new Ray({ x: token.x, y: token.y }, { x: target.x, y: target.y }) }], { gridSpaces: true })[0];
      let currentBand;
      for (let band in weapon2.range.bands) {
        if (distance >= weapon2.range.bands[band].range[0] && distance <= weapon2.range.bands[band].range[1]) {
          currentBand = band;
          break;
        }
      }
      modifier += weapon2.range.bands[currentBand]?.modifier || 0;
      if (modifier) {
        tooltip.push(`${game.i18n.localize("Range")} - ${currentBand}`);
      }
      return modifier;
    }
    sizePrefillModifiers(item, type, options, tooltip) {
      let slBonus = 0;
      let successBonus = 0;
      let modifier = 0;
      try {
        let target = game.user.targets.size ? Array.from(game.user.targets)[0].actor : void 0;
        let attacker;
        if (this.flags.oppose) {
          let attackMessage = game.messages.get(this.flags.oppose.opposeMessageId).getOppose().attackerMessage;
          let attackerTest = attackMessage.getTest();
          attacker = {
            speaker: attackMessage.speaker,
            test: attackerTest,
            messageId: attackMessage.id,
            img: WFRP_Utility.getSpeaker(attackMessage.speaker).img
          };
        }
        if (attacker) {
          let sizeDiff = game.wfrp4e.config.actorSizeNums[attacker.test.size] - this.sizeNum;
          if (sizeDiff >= 1) {
            if (item.attackType == "melee") {
              tooltip.push(game.i18n.localize("CHAT.TestModifiers.DefendingLarger"));
              slBonus += -2 * sizeDiff;
            }
          }
        } else if (target) {
          let sizeDiff = this.sizeNum - target.sizeNum;
          if (sizeDiff < 0 && (item.attackType == "melee" || target.sizeNum <= 3)) {
            modifier += 10;
            tooltip.push(game.i18n.localize("CHAT.TestModifiers.AttackingLarger"));
          } else if (item.attackType == "ranged") {
            let sizeModifier = 0;
            if (target.details.size.value == "tiny")
              sizeModifier -= 30;
            if (target.details.size.value == "ltl")
              sizeModifier -= 20;
            if (target.details.size.value == "sml")
              sizeModifier -= 10;
            if (target.details.size.value == "lrg")
              sizeModifier += 20;
            if (target.details.size.value == "enor")
              sizeModifier += 40;
            if (target.details.size.value == "mnst")
              sizeModifier += 60;
            modifier += sizeModifier;
            options.sizeModifier = sizeModifier;
            if (target.sizeNum > 3 || target.sizeNum < 3)
              tooltip.push(game.i18n.format("CHAT.TestModifiers.ShootingSizeModifier", { size: game.wfrp4e.config.actorSizes[target.details.size.value] }));
          }
        }
        if (this.isMounted && item.attackType == "melee" && target) {
          let mountSizeDiff = this.mount.sizeNum - target.sizeNum;
          if (target.isMounted)
            mountSizeDiff = this.mount.sizeNum - target.sizeNum;
          if (mountSizeDiff >= 1) {
            tooltip.push(game.i18n.localize("CHAT.TestModifiers.AttackerMountLarger"));
            modifier += 20;
          }
        } else if (item.attackType == "melee" && target && target.isMounted) {
          let mountSizeDiff = target.mount.sizeNum - this.sizeNum;
          if (this.isMounted)
            mountSizeDiff = target.sizeNum - this.mount.sizeNum;
          if (mountSizeDiff >= 1) {
            tooltip.push(game.i18n.localize("CHAT.TestModifiers.DefenderMountLarger"));
            modifier -= 10;
          }
        }
      } catch (e) {
        console.error("Something went wrong with applying weapon modifiers: " + e);
        slBonus = 0;
        successBonus = 0;
        modifier = 0;
      }
      return {
        sizeModifier: modifier,
        sizeSuccessBonus: successBonus,
        sizeSLBonus: slBonus
      };
    }
    armourPrefillModifiers(item, type, options, tooltip = []) {
      let modifier = 0;
      let stealthPenaltyValue = 0;
      let wearingMail = false;
      let wearingPlate = false;
      let practicals = 0;
      for (let a of this.getItemTypes("armour").filter((i) => i.isEquipped)) {
        if (a.armorType.value == "mail")
          wearingMail = true;
        if (a.armorType.value == "plate")
          wearingPlate = true;
        if (a.practical)
          practicals++;
      }
      if (wearingMail || wearingPlate) {
        let stealthPenaltyValue2 = 0;
        if (wearingMail)
          stealthPenaltyValue2 += -10;
        if (wearingPlate)
          stealthPenaltyValue2 += -10;
        if (stealthPenaltyValue2 && practicals)
          stealthPenaltyValue2 += 10 * practicals;
        if (stealthPenaltyValue2 > 0)
          stealthPenaltyValue2 = 0;
        if (type == "skill" && item.name.includes(game.i18n.localize("NAME.Stealth"))) {
          if (stealthPenaltyValue2) {
            modifier += stealthPenaltyValue2;
            tooltip.push(game.i18n.localize("SHEET.ArmourPenalties"));
          }
        }
      }
      return modifier;
    }
    runEffects(trigger, args, options = {}) {
      let effects = this.actorEffects.filter((e) => e.trigger == trigger && e.script && !e.disabled);
      if (trigger == "oneTime") {
        effects = effects.filter((e) => e.application != "apply" && e.application != "damage");
        if (effects.length)
          this.deleteEmbeddedDocuments("ActiveEffect", effects.map((e) => e.id));
      }
      if (trigger == "targetPrefillDialog" && game.user.targets.size) {
        effects = game.user.targets.values().next().value.actor.actorEffects.filter((e) => e.trigger == "targetPrefillDialog" && !e.disabled).map((e) => e);
        let secondaryEffects = game.user.targets.values().next().value.actor.actorEffects.filter((e) => getProperty(e, "flags.wfrp4e.secondaryEffect.effectTrigger") == "targetPrefillDialog" && !e.disabled);
        effects = effects.concat(secondaryEffects.map((e) => {
          let newEffect = e.toObject();
          newEffect.flags.wfrp4e.effectTrigger = newEffect.flags.wfrp4e.secondaryEffect.effectTrigger;
          newEffect.flags.wfrp4e.script = newEffect.flags.wfrp4e.secondaryEffect.script;
          return new EffectWfrp4e(newEffect, { parent: e.parent });
        }));
      }
      effects.forEach((e) => {
        try {
          let func;
          if (!options.async)
            func = new Function("args", e.script).bind({ actor: this, effect: e, item: e.item });
          else if (options.async) {
            let asyncFunction = Object.getPrototypeOf(async function() {
            }).constructor;
            func = new asyncFunction("args", e.script).bind({ actor: this, effect: e, item: e.item });
          }
          WFRP_Utility.log(`${this.name} > Running ${e.label}`);
          func(args);
        } catch (ex) {
          ui.notifications.error(game.i18n.format("ERROR.EFFECT", { effect: e.label }));
          console.error("Error when running effect " + e.label + " - If this effect comes from an official module, try replacing the actor/item from the one in the compendium. If it still throws this error, please use the Bug Reporter and paste the details below, as well as selecting which module and 'Effect Report' as the label.");
          console.error(`REPORT
-------------------
EFFECT:	${e.label}
ACTOR:	${this.name} - ${this.id}
ERROR:	${ex}`);
        }
      });
      return effects;
    }
    async decrementInjuries() {
      this.injuries.forEach((i) => this.decrementInjury(i));
    }
    async decrementInjury(injury) {
      if (isNaN(injury.system.duration.value))
        return ui.notifications.notify(game.i18n.format("CHAT.InjuryError", { injury: injury.name }));
      injury = duplicate(injury);
      injury.system.duration.value--;
      if (injury.system.duration.value < 0)
        injury.system.duration.value = 0;
      if (injury.system.duration.value == 0) {
        let chatData = game.wfrp4e.utility.chatDataSetup(game.i18n.format("CHAT.InjuryFinish", { injury: injury.name }), "gmroll");
        chatData.speaker = { alias: this.name };
        ChatMessage.create(chatData);
      }
      this.updateEmbeddedDocuments("Item", [injury]);
    }
    async decrementDiseases() {
      this.diseases.forEach((d) => this.decrementDisease(d));
    }
    async decrementDisease(disease) {
      let d = duplicate(disease);
      if (!d.system.duration.active) {
        if (Number.isNumeric(d.system.incubation.value)) {
          d.system.incubation.value--;
          if (d.system.incubation.value <= 0) {
            this.activateDisease(d);
            d.system.incubation.value = 0;
          }
        } else {
          let chatData = game.wfrp4e.utility.chatDataSetup(`Attempted to decrement ${d.name} incubation but value is non-numeric`, "gmroll", false);
          chatData.speaker = { alias: this.name };
          ChatMessage.create(chatData);
        }
      } else {
        if (Number.isNumeric(d.system.duration.value)) {
          d.system.duration.value--;
          if (d.system.duration.value == 0)
            this.finishDisease(d);
        } else {
          let chatData = game.wfrp4e.utility.chatDataSetup(`Attempted to decrement ${d.name} duration but value is non-numeric`, "gmroll", false);
          chatData.speaker = { alias: this.name };
          ChatMessage.create(chatData);
        }
      }
      this.updateEmbeddedDocuments("Item", [d]);
    }
    async activateDisease(disease) {
      disease.system.duration.active = true;
      disease.system.incubation.value = 0;
      let msg = game.i18n.format("CHAT.DiseaseIncubation", { disease: disease.name });
      try {
        let durationRoll = (await new Roll(disease.system.duration.value).roll()).total;
        msg += game.i18n.format("CHAT.DiseaseDuration", { duration: durationRoll, unit: disease.system.duration.unit });
        disease.system.duration.value = durationRoll;
      } catch (e) {
        msg += game.i18n.localize("CHAT.DiseaseDurationError");
      }
      let chatData = game.wfrp4e.utility.chatDataSetup(msg, "gmroll", false);
      chatData.speaker = { alias: this.name };
      ChatMessage.create(chatData);
    }
    async finishDisease(disease) {
      let msg = game.i18n.format("CHAT.DiseaseFinish", { disease: disease.name });
      if (disease.system.symptoms.includes("lingering")) {
        let lingering = disease.effects.find((e) => e.label.includes("Lingering"));
        if (lingering) {
          let difficulty = lingering.label.substring(lingering.label.indexOf("(") + 1, lingeringLabel.indexOf(")")).toLowerCase();
          this.setupSkill(game.i18n.localize("NAME.Endurance"), { difficulty }).then((setupData) => this.basicTest(setupData).then(async (test) => {
            if (test.result.outcome == "failure") {
              let negSL = Math.abs(test.result.SL);
              if (negSL <= 1) {
                let roll = (await new Roll("1d10").roll()).total;
                msg += game.i18n.format("CHAT.LingeringExtended", { duration: roll });
              } else if (negSL <= 5) {
                msg += game.i18n.localize("CHAT.LingeringFestering");
                fromUuid("Compendium.wfrp4e-core.diseases.kKccDTGzWzSXCBOb").then((disease2) => {
                  this.createEmbeddedDocuments("Item", [disease2.toObject()]);
                });
              } else if (negSL >= 6) {
                msg += game.i18n.localize("CHAT.LingeringRot");
                fromUuid("Compendium.wfrp4e-core.diseases.M8XyRs9DN12XsFTQ").then((disease2) => {
                  this.createEmbeddedDocuments("Item", [disease2.toObject()]);
                });
              }
            }
          }));
        }
      } else {
        await this.deleteEmbeddedDocuments("ActiveEffect", [removeEffects]);
        this.deleteEffectsFromItem(disease._id);
      }
      let chatData = game.wfrp4e.utility.chatDataSetup(msg, "gmroll", false);
      chatData.speaker = { alias: this.name };
      ChatMessage.create(chatData);
    }
    _applyStatusModifier({ standing, tier }) {
      let modifier = this.details.status.modifier || 0;
      if (modifier < 0)
        this.details.status.modified = "negative";
      else if (modifier > 0)
        this.details.status.modified = "positive";
      let temp = standing;
      standing += modifier;
      modifier = -Math.abs(temp);
      if (standing <= 0 && tier != "b") {
        standing = 5 + standing;
        if (tier == "g")
          tier = "s";
        else if (tier == "s")
          tier = "b";
        if (standing <= 0 && tier != "b") {
          standing = 5 + standing;
          tier = "b";
        }
        if (standing < 0)
          standing = 0;
      } else if (standing <= 0 && tier == "b") {
        standing = 0;
      } else if (standing > 5 && tier != "g") {
        standing = standing - 5;
        if (tier == "s")
          tier = "g";
        else if (tier == "b")
          tier = "s";
        if (standing > 5 && tier != "g") {
          standing -= 5;
          tier = "g";
        }
      }
      return { standing, tier };
    }
    async handleIncomeTest(roll) {
      let { standing, tier } = roll.options.income;
      let result = roll.result;
      let dieAmount = game.wfrp4e.config.earningValues[tier];
      dieAmount = parseInt(dieAmount) * standing;
      let moneyEarned;
      if (tier != "g") {
        dieAmount = dieAmount + "d10";
        moneyEarned = (await new Roll(dieAmount).roll()).total;
      } else
        moneyEarned = dieAmount;
      if (result.outcome == "success") {
        roll.result.incomeResult = game.i18n.localize("INCOME.YouEarn") + " " + moneyEarned;
        switch (tier) {
          case "b":
            result.incomeResult += ` ${game.i18n.localize("NAME.BPPlural").toLowerCase()}.`;
            break;
          case "s":
            result.incomeResult += ` ${game.i18n.localize("NAME.SSPlural").toLowerCase()}.`;
            break;
          case "g":
            if (moneyEarned > 1)
              result.incomeResult += ` ${game.i18n.localize("NAME.GC").toLowerCase()}.`;
            else
              result.incomeResult += ` ${game.i18n.localize("NAME.GCPlural").toLowerCase()}.`;
            break;
        }
      } else if (Number(result.SL) > -6) {
        moneyEarned /= 2;
        result.incomeResult = game.i18n.localize("INCOME.YouEarn") + " " + moneyEarned;
        switch (tier) {
          case "b":
            result.incomeResult += ` ${game.i18n.localize("NAME.BPPlural").toLowerCase()}.`;
            break;
          case "s":
            result.incomeResult += ` ${game.i18n.localize("NAME.SSPlural").toLowerCase()}.`;
            break;
          case "g":
            if (moneyEarned > 1)
              result.incomeResult += ` ${game.i18n.localize("NAME.GC").toLowerCase()}.`;
            else
              result.incomeResult += ` ${game.i18n.localize("NAME.GCPlural").toLowerCase()}.`;
            break;
        }
      } else {
        result.incomeResult = game.i18n.localize("INCOME.Failure");
        moneyEarned = 0;
      }
      result.moneyEarned = moneyEarned + tier;
      return result;
    }
    async handleCorruptionResult(test) {
      let strength = test.options.corruption;
      let failed = test.result.outcome == "failure";
      let corruption = 0;
      switch (strength) {
        case "minor":
          if (failed)
            corruption++;
          break;
        case "moderate":
          if (failed)
            corruption += 2;
          else if (test.result.SL < 2)
            corruption += 1;
          break;
        case "major":
          if (failed)
            corruption += 3;
          else if (test.result.SL < 2)
            corruption += 2;
          else if (test.result.SL < 4)
            corruption += 1;
          break;
      }
      if (test.context.reroll || test.context.fortuneUsedAddSL) {
        let previousFailed = test.context.previousResult.outcome == "failure";
        switch (strength) {
          case "minor":
            if (previousFailed)
              corruption--;
            break;
          case "moderate":
            if (previousFailed)
              corruption -= 2;
            else if (test.context.previousResult.SL < 2)
              corruption -= 1;
            break;
          case "major":
            if (previousFailed)
              corruption -= 3;
            else if (test.context.previousResult.SL < 2)
              corruption -= 2;
            else if (test.context.previousResult.SL < 4)
              corruption -= 1;
            break;
        }
      }
      let newCorruption = Number(this.status.corruption.value) + corruption;
      if (newCorruption < 0)
        newCorruption = 0;
      if (!test.context.reroll && !test.context.fortuneUsedAddSL)
        ChatMessage.create(WFRP_Utility.chatDataSetup(game.i18n.format("CHAT.CorruptionFail", { name: this.name, number: corruption }), "gmroll", false));
      else
        ChatMessage.create(WFRP_Utility.chatDataSetup(game.i18n.format("CHAT.CorruptionReroll", { name: this.name, number: corruption }), "gmroll", false));
      await this.update({ "system.status.corruption.value": newCorruption });
      if (corruption > 0)
        this.checkCorruption();
    }
    async checkCorruption() {
      if (this.status.corruption.value > this.status.corruption.max) {
        let skill = this.has(game.i18n.localize("NAME.Endurance"), "skill");
        if (skill) {
          this.setupSkill(skill, { title: game.i18n.format("DIALOG.MutateTitle", { test: skill.name }), mutate: true }).then((setupData) => {
            this.basicTest(setupData);
          });
        } else {
          this.setupCharacteristic("t", { title: game.i18n.format("DIALOG.MutateTitle", { test: game.wfrp4e.config.characteristics["t"] }), mutate: true }).then((setupData) => {
            this.basicTest(setupData);
          });
        }
      }
    }
    async handleMutationResult(test) {
      let failed = test.result.outcome == "failure";
      if (failed) {
        let wpb = this.characteristics.wp.bonus;
        let tableText = game.i18n.localize("CHAT.MutateTable") + "<br>" + game.wfrp4e.config.corruptionTables.map((t) => `@Table[${t}]<br>`).join("");
        ChatMessage.create(WFRP_Utility.chatDataSetup(
          `
      <h3>${game.i18n.localize("CHAT.DissolutionTitle")}</h3> 
      <p>${game.i18n.localize("CHAT.Dissolution")}</p>
      <p>${game.i18n.format("CHAT.CorruptionLoses", { name: this.name, number: wpb })}
      <p>${tableText}</p>`,
          "gmroll",
          false
        ));
        this.update({ "system.status.corruption.value": Number(this.status.corruption.value) - wpb });
      } else
        ChatMessage.create(WFRP_Utility.chatDataSetup(game.i18n.localize("CHAT.MutateSuccess"), "gmroll", false));
    }
    deleteEffectsFromItem(itemId) {
      let removeEffects2 = this.effects.filter((e) => {
        if (!e.origin)
          return false;
        return e.origin.includes(itemId);
      }).map((e) => e.id).filter((id) => this.actorEffects.has(id));
      this.deleteEmbeddedDocuments("ActiveEffect", removeEffects2);
    }
    async handleExtendedTest(test) {
      let item = this.items.get(test.options.extended).toObject();
      if (game.settings.get("wfrp4e", "extendedTests") && test.result.SL == 0)
        test.result.SL = test.result.roll <= test.result.target ? 1 : -1;
      if (item.system.failingDecreases.value) {
        item.system.SL.current += Number(test.result.SL);
        if (!item.system.negativePossible.value && item.system.SL.current < 0)
          item.system.SL.current = 0;
      } else if (test.result.SL > 0)
        item.system.SL.current += Number(test.result.SL);
      let displayString = `${item.name} ${item.system.SL.current} / ${item.system.SL.target} ${game.i18n.localize("SuccessLevels")}`;
      if (item.system.SL.current >= item.system.SL.target) {
        if (getProperty(item, "flags.wfrp4e.reloading")) {
          let actor;
          if (getProperty(item, "flags.wfrp4e.vehicle"))
            actor = WFRP_Utility.getSpeaker(getProperty(item, "flags.wfrp4e.vehicle"));
          actor = actor ? actor : this;
          let weapon2 = actor.items.get(getProperty(item, "flags.wfrp4e.reloading"));
          weapon2.update({ "flags.wfrp4e.-=reloading": null, "system.loaded.amt": weapon2.loaded.max, "system.loaded.value": true });
        }
        if (item.system.completion.value == "reset")
          item.system.SL.current = 0;
        else if (item.system.completion.value == "remove") {
          await this.deleteEmbeddedDocuments("Item", [item._id]);
          this.deleteEffectsFromItem(item._id);
          item = void 0;
        }
        displayString = displayString.concat(`<br><b>${game.i18n.localize("Completed")}</b>`);
      }
      test.result.other.push(displayString);
      if (item)
        this.updateEmbeddedDocuments("Item", [item]);
    }
    checkReloadExtendedTest(weapon2) {
      if (!weapon2.loading)
        return;
      let reloadingTest = this.items.get(weapon2.getFlag("wfrp4e", "reloading"));
      if (weapon2.loaded.amt > 0) {
        if (reloadingTest) {
          reloadingTest.delete();
          weapon2.update({ "flags.wfrp4e.-=reloading": null });
          return ui.notifications.notify(game.i18n.localize("ITEM.ReloadFinish"));
        }
      } else {
        let reloadExtendedTest = duplicate(game.wfrp4e.config.systemItems.reload);
        reloadExtendedTest.name = game.i18n.format("ITEM.ReloadingWeapon", { weapon: weapon2.name });
        if (weapon2.skillToUse)
          reloadExtendedTest.system.test.value = weapon2.skillToUse.name;
        else
          reloadExtendedTest.system.test.value = game.i18n.localize("CHAR.BS");
        reloadExtendedTest.flags.wfrp4e.reloading = weapon2.id;
        reloadExtendedTest.system.SL.target = weapon2.properties.flaws.reload?.value || 1;
        if (weapon2.actor.type == "vehicle") {
          let vehicleSpeaker;
          if (weapon2.actor.isToken)
            vehicleSpeaker = {
              token: weapon2.actor.token.id,
              scene: weapon2.actor.token.parent.id
            };
          else
            vehicleSpeaker = {
              actor: weapon2.actor.id
            };
          reloadExtendedTest.flags.wfrp4e.vehicle = vehicleSpeaker;
        }
        if (reloadingTest)
          reloadingTest.delete();
        this.createEmbeddedDocuments("Item", [reloadExtendedTest]).then((item) => {
          ui.notifications.notify(game.i18n.format("ITEM.CreateReloadTest", { weapon: weapon2.name }));
          weapon2.update({ "flags.wfrp4e.reloading": item[0].id });
        });
      }
    }
    setAdvantage(val) {
      let advantage = duplicate(this.status.advantage);
      if (game.settings.get("wfrp4e", "capAdvantageIB"))
        advantage.max = this.characteristics.i.bonus;
      else
        advantage.max = 10;
      advantage.value = Math.clamped(val, 0, advantage.max);
      this.update({ "system.status.advantage": advantage });
    }
    modifyAdvantage(val) {
      this.setAdvantage(this.status.advantage.value + val);
    }
    setWounds(val) {
      let wounds = duplicate(this.status.wounds);
      wounds.value = Math.clamped(val, 0, wounds.max);
      return this.update({ "system.status.wounds": wounds });
    }
    modifyWounds(val) {
      return this.setWounds(this.status.wounds.value + val);
    }
    showCharging(item) {
      if (item.attackType == "melee")
        return true;
    }
    get isMounted() {
      return getProperty(this, "system.status.mount.mounted") && this.status.mount.id;
    }
    get mount() {
      if (this.status.mount.isToken) {
        let scene = game.scenes.get(this.status.mount.tokenData.scene);
        if (canvas.scene.id != scene?.id)
          return ui.notifications.error(game.i18n.localize("ErrorTokenMount"));
        let token = canvas.tokens.get(this.status.mount.tokenData.token);
        if (token)
          return token.actor;
      }
      let mount = game.actors.get(this.status.mount.id);
      return mount;
    }
    showDualWielding(weapon2) {
      if (!weapon2.offhand.value && this.has(game.i18n.localize("NAME.DualWielder"), "talent")) {
        return !this.noOffhand;
      }
      return false;
    }
    async addCondition(effect, value = 1) {
      if (typeof effect === "string")
        effect = duplicate(game.wfrp4e.config.statusEffects.find((e) => e.id == effect));
      if (!effect)
        return "No Effect Found";
      if (!effect.id)
        return "Conditions require an id field";
      let existing = this.hasCondition(effect.id);
      if (existing && !existing.isNumberedCondition)
        return existing;
      else if (existing) {
        existing._displayScrollingStatus(true);
        return existing.setFlag("wfrp4e", "value", existing.conditionValue + value);
      } else if (!existing) {
        if (game.combat && (effect.id == "blinded" || effect.id == "deafened"))
          effect.flags.wfrp4e.roundReceived = game.combat.round;
        effect.label = game.i18n.localize(effect.label);
        if (Number.isNumeric(effect.flags.wfrp4e.value))
          effect.flags.wfrp4e.value = value;
        if (effect.id == "dead")
          effect["flags.core.overlay"] = true;
        if (effect.id == "unconscious")
          await this.addCondition("prone");
        return this.createEmbeddedDocuments("ActiveEffect", [effect]);
      }
    }
    async removeCondition(effect, value = 1) {
      if (typeof effect === "string")
        effect = duplicate(game.wfrp4e.config.statusEffects.find((e) => e.id == effect));
      if (!effect)
        return "No Effect Found";
      if (!effect.id)
        return "Conditions require an id field";
      let existing = this.hasCondition(effect.id);
      if (existing && !existing.isNumberedCondition) {
        if (effect.id == "unconscious")
          await this.addCondition("fatigued");
        return existing.delete();
      } else if (existing) {
        await existing.setFlag("wfrp4e", "value", existing.conditionValue - value);
        if (existing.conditionValue)
          existing._displayScrollingStatus(false);
        if (existing.conditionValue == 0 && (effect.id == "bleeding" || effect.id == "poisoned" || effect.id == "broken" || effect.id == "stunned")) {
          if (!game.settings.get("wfrp4e", "mooConditions") || !effect.id == "broken")
            await this.addCondition("fatigued");
        }
        if (existing.conditionValue <= 0)
          return existing.delete();
      }
    }
    hasCondition(conditionKey) {
      let existing = this.actorEffects.find((i) => i.conditionId == conditionKey);
      return existing;
    }
    applyFear(value, name = void 0) {
      value = value || 0;
      let fear = duplicate(game.wfrp4e.config.systemItems.fear);
      fear.system.SL.target = value;
      if (name)
        fear.effects[0].flags.wfrp4e.fearName = name;
      this.createEmbeddedDocuments("Item", [fear]).then((items) => {
        this.setupExtendedTest(items[0]);
      });
    }
    applyTerror(value, name = void 0) {
      value = value || 1;
      let terror = duplicate(game.wfrp4e.config.systemItems.terror);
      terror.flags.wfrp4e.terrorValue = value;
      game.wfrp4e.utility.applyOneTimeEffect(terror, this);
    }
    awardExp(amount, reason) {
      let experience = duplicate(this.details.experience);
      experience.total += amount;
      experience.log.push({ reason, amount, spent: experience.spent, total: experience.total, type: "total" });
      this.update({ "system.details.experience": experience });
      ChatMessage.create({ content: game.i18n.format("CHAT.ExpReceived", { amount, reason }), speaker: { alias: this.name } });
    }
    _addToExpLog(amount, reason, newSpent, newTotal) {
      if (!newSpent)
        newSpent = this.details.experience.spent;
      if (!newTotal)
        newTotal = this.details.experience.total;
      let expLog = duplicate(this.details.experience.log || []);
      expLog.push({ amount, reason, spent: newSpent, total: newTotal, type: newSpent ? "spent" : "total" });
      return expLog;
    }
    populateEffect(effectId, item, test) {
      if (typeof item == "string")
        item = this.items.get(item);
      let effect = item.effects.get(effectId)?.toObject();
      if (!effect && item.ammo)
        effect = item.ammo.effects.get(effectId)?.toObject();
      if (!effect)
        return ui.notifications.error(game.i18n.localize("ERROR.EffectNotFound"));
      effect.origin = this.uuid;
      let multiplier = 1;
      if (test && test.result.overcast && test.result.overcast.usage.duration)
        multiplier += test.result.overcast.usage.duration.count;
      if (item.duration && item.duration.value.toLowerCase().includes(game.i18n.localize("minutes")))
        effect.duration.seconds = parseInt(item.Duration) * 60 * multiplier;
      else if (item.duration && item.duration.value.toLowerCase().includes(game.i18n.localize("hours")))
        effect.duration.seconds = parseInt(item.Duration) * 60 * 60 * multiplier;
      else if (item.duration && item.duration.value.toLowerCase().includes(game.i18n.localize("rounds")))
        effect.duration.rounds = parseInt(item.Duration) * multiplier;
      let script = getProperty(effect, "flags.wfrp4e.script");
      if (test && script) {
        let regex = /{{(.+?)}}/g;
        let matches = [...script.matchAll(regex)];
        matches.forEach((match) => {
          script = script.replace(match[0], getProperty(test.result, match[1]));
        });
        setProperty(effect, "flags.wfrp4e.script", script);
      }
      return effect;
    }
    checkSystemEffects() {
      let encumbrance = this.status.encumbrance.state;
      let state;
      if (encumbrance > 3) {
        state = "enc3";
        if (!this.hasSystemEffect(state)) {
          this.addSystemEffect(state);
          return;
        }
        this.removeSystemEffect("enc2");
        this.removeSystemEffect("enc1");
      } else if (encumbrance > 2) {
        state = "enc2";
        if (!this.hasSystemEffect(state)) {
          this.addSystemEffect(state);
          return;
        }
        this.removeSystemEffect("enc1");
        this.removeSystemEffect("enc3");
      } else if (encumbrance > 1) {
        state = "enc1";
        if (!this.hasSystemEffect(state)) {
          this.addSystemEffect(state);
          return;
        }
        this.removeSystemEffect("enc2");
        this.removeSystemEffect("enc3");
      } else {
        this.removeSystemEffect("enc1");
        this.removeSystemEffect("enc2");
        this.removeSystemEffect("enc3");
      }
    }
    addSystemEffect(key) {
      let systemEffects = game.wfrp4e.utility.getSystemEffects();
      let effect = systemEffects[key];
      setProperty(effect, "flags.core.statusId", key);
      this.createEmbeddedDocuments("ActiveEffect", [effect]);
    }
    removeSystemEffect(key) {
      let effect = this.actorEffects.find((e) => e.statusId == key);
      if (effect)
        this.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
    }
    hasSystemEffect(key) {
      return this.hasCondition(key);
    }
    displayStatus(round = void 0, nameOverride) {
      if (round)
        round = game.i18n.format("CondRound", { round });
      let displayConditions = this.actorEffects.map((e) => {
        if (e.statusId && !e.disabled) {
          return e.label + " " + (e.conditionValue || "");
        }
      }).filter((i) => !!i);
      let chatOptions = {
        rollMode: game.settings.get("core", "rollMode")
      };
      if (["gmroll", "blindroll"].includes(chatOptions.rollMode))
        chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
      if (chatOptions.rollMode === "blindroll")
        chatOptions["blind"] = true;
      chatOptions["template"] = "systems/wfrp4e/templates/chat/combat-status.html";
      let chatData = {
        name: nameOverride || (this.token ? this.token.name : this.prototypeToken.name),
        conditions: displayConditions,
        modifiers: this.flags.modifier,
        round
      };
      return renderTemplate(chatOptions.template, chatData).then((html) => {
        chatOptions["user"] = game.user.id;
        chatOptions["content"] = html;
        chatOptions["type"] = 0;
        ChatMessage.create(chatOptions, false);
        return html;
      });
    }
    async _getNewActorItems() {
      let basicSkills = await WFRP_Utility.allBasicSkills() || [];
      let moneyItems = (await WFRP_Utility.allMoneyItems() || []).map((m) => {
        m.system.quantity.value = 0;
        return m;
      }).sort((a, b) => a.system.coinValue.value >= b.system.coinValue.value ? -1 : 1) || [];
      if (this.type == "character")
        return basicSkills.concat(moneyItems);
      else if (this.type == "npc" || this.type == "creature") {
        return new Promise((resolve) => {
          new Dialog({
            title: game.i18n.localize("ACTOR.BasicSkillsTitle"),
            content: `<p>${game.i18n.localize("ACTOR.BasicSkillsPrompt")}</p>`,
            buttons: {
              yes: {
                label: game.i18n.localize("Yes"),
                callback: async (dlg) => {
                  resolve(basicSkills.concat(moneyItems));
                }
              },
              no: {
                label: game.i18n.localize("No"),
                callback: async (dlg) => {
                  resolve([]);
                }
              }
            },
            default: "yes"
          }).render(true);
        });
      } else
        return [];
    }
    getItemTypes(type) {
      return (this.itemCategories || this.itemTypes)[type];
    }
    clearOpposed() {
      return this.update({ "flags.-=oppose": null });
    }
    get isUniqueOwner() {
      return game.user.id == game.users.find((u) => u.active && (this.ownership[u.id] >= 3 || u.isGM))?.id;
    }
    get inCollection() {
      return game.actors && game.actors.get(this.id);
    }
    get hasSpells() {
      return !!this.getItemTypes("spell").length > 0;
    }
    get hasPrayers() {
      return !!this.getItemTypes("prayer").length > 0;
    }
    get noOffhand() {
      return !this.getItemTypes("weapon").find((i) => i.offhand.value);
    }
    get isOpposing() {
      return !!this.flags.oppose;
    }
    speakerData(token) {
      if (this.isToken || token) {
        return {
          token: token?.id || this.token.id,
          scene: token?.parent.id || this.token.parent.id
        };
      } else {
        return {
          actor: this.id,
          token: token?.id,
          scene: token?.parent.id
        };
      }
    }
    get Species() {
      let species = game.wfrp4e.config.species[this.details.species.value] || this.details.species.value;
      if (this.details.species.subspecies && game.wfrp4e.config.subspecies[this.details.species.value] && game.wfrp4e.config.subspecies[this.details.species.value][this.details.species.subspecies])
        species += ` (${game.wfrp4e.config.subspecies[this.details.species.value][this.details.species.subspecies].name})`;
      else if (this.details.species.subspecies)
        species += ` (${this.details.species.subspecies})`;
      return species;
    }
    get sizeNum() {
      return game.wfrp4e.config.actorSizeNums[this.details.size.value];
    }
    get equipPointsUsed() {
      return this.getItemTypes("weapon").reduce((prev, current) => {
        if (current.isEquipped)
          prev += current.twohanded.value ? 2 : 1;
        return prev;
      }, 0);
    }
    get equipPointsAvailable() {
      return Number.isNumeric(this.flags.equipPoints) ? this.flags.equipPoints : 2;
    }
    get defensive() {
      return this.getItemTypes("weapon").reduce((prev, current) => {
        if (current.isEquipped)
          prev += current.properties.qualities.defensive ? 1 : 0;
        return prev;
      }, 0);
    }
    get currentCareer() {
      return this.getItemTypes("career").find((c) => c.current.value);
    }
    get passengers() {
      return this.system.passengers.map((p) => {
        let actor = game.actors.get(p?.id);
        if (actor)
          return {
            actor,
            linked: actor.prototypeToken.actorLink,
            count: p.count,
            enc: game.wfrp4e.config.actorSizeEncumbrance[actor.details.size.value] * p.count
          };
      });
    }
    get attacker() {
      try {
        if (this.flags.oppose) {
          let opposeMessage = game.messages.get(this.flags.oppose.opposeMessageId);
          let oppose = opposeMessage.getOppose();
          let attackerMessage = oppose.attackerMessage;
          if (opposeMessage)
            return {
              speaker: attackerMessage.speaker,
              test: attackerMessage.getTest(),
              messageId: attackerMessage.id,
              img: WFRP_Utility.getSpeaker(attackerMessage.speaker).img
            };
          else
            this.update({ "flags.-=oppose": null });
        }
      } catch (e) {
        this.update({ "flags.-=oppose": null });
      }
    }
    get advantageGroup() {
      if (this.hasPlayerOwner)
        return "players";
      else if (this.token)
        return this.token.disposition == CONST.TOKEN_DISPOSITIONS.FRIENDLY ? "players" : "enemies";
      else
        return this.prototypeToken.disposition == CONST.TOKEN_DISPOSITIONS.FRIENDLY ? "players" : "enemies";
    }
    get characteristics() {
      return this.system.characteristics;
    }
    get status() {
      return this.system.status;
    }
    get details() {
      return this.system.details;
    }
    get excludedTraits() {
      return this.system.excludedTraits;
    }
    get roles() {
      return this.system.roles;
    }
    get armour() {
      return this.status.armour;
    }
    toCompendium(pack) {
      let data = super.toCompendium(pack);
      data._id = this.id;
      return data;
    }
  };

  // modules/apps/homebrew-settings.js
  var HomebrewSettings = class extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "homebrew-settings";
      options.template = "systems/wfrp4e/templates/apps/homebrew-settings.html";
      options.width = 600;
      options.minimizable = true;
      options.resizable = true;
      options.title = "Homebrew Settings";
      return options;
    }
    getData() {
      let data = super.getData();
      data.settings = Array.from(game.settings.settings).filter((s) => s[1].homebrew).map((i) => i[1]);
      data.settings = data.settings.filter((s) => !s.key.includes("moo"));
      data.mooSettings = Array.from(game.settings.settings).filter((s) => s[1].homebrew).map((i) => i[1]).filter((s) => s.key.includes("moo"));
      data.settings.forEach((s) => s.inputType = s.type == Boolean ? "checkbox" : "text");
      data.mooSettings.forEach((s) => s.inputType = s.type == Boolean ? "checkbox" : "text");
      data.settings.forEach((s) => s.value = game.settings.get(s.namespace, s.key));
      data.mooSettings.forEach((s) => s.value = game.settings.get(s.namespace, s.key));
      return data;
    }
    async _updateObject(event2, formData) {
      for (let setting in formData)
        game.settings.set("wfrp4e", setting, formData[setting]);
    }
  };

  // modules/hooks/init.js
  var debouncedReload = foundry.utils.debounce(() => {
    window.location.reload();
  }, 100);
  function init_default() {
    Hooks.once("init", () => {
      TravelDistanceWfrp4e.loadTravelData();
      game.settings.register("wfrp4e", "systemMigrationVersion", {
        name: "System Migration Version",
        scope: "world",
        config: false,
        type: String,
        default: 0
      });
      game.settings.registerMenu("wfrp4e", "homebrew", {
        name: "WFRP4e House Rules",
        label: "WFRP4e Homebrew",
        hint: "Settings for common homebrew/house rules",
        type: HomebrewSettings,
        restricted: true
      });
      game.settings.register("wfrp4e", "initiativeRule", {
        name: "SETTINGS.InitRule",
        hint: "SETTINGS.InitHint",
        scope: "world",
        config: true,
        default: "default",
        type: String,
        choices: {
          "default": "SETTINGS.InitDefault",
          "sl": "SETTINGS.InitSL",
          "d10Init": "SETTINGS.InitD10",
          "d10InitAgi": "SETTINGS.InitD10Agi"
        },
        onChange: (rule) => _setWfrp4eInitiative(rule)
      });
      _setWfrp4eInitiative(game.settings.get("wfrp4e", "initiativeRule"));
      function _setWfrp4eInitiative(initMethod) {
        let formula;
        switch (initMethod) {
          case "default":
            formula = "@characteristics.i.value + @characteristics.ag.value/100";
            break;
          case "sl":
            formula = "(floor(@characteristics.i.value / 10) - floor(1d100/10))";
            break;
          case "d10Init":
            formula = "1d10 + @characteristics.i.value";
            break;
          case "d10InitAgi":
            formula = "1d10 + @characteristics.i.bonus + @characteristics.ag.bonus";
            break;
        }
        let decimals = initMethod == "default" ? 2 : 0;
        CONFIG.Combat.initiative = {
          formula,
          decimals
        };
      }
      game.settings.register("wfrp4e", "capAdvantageIB", {
        name: "SETTINGS.CapAdvIB",
        hint: "SETTINGS.CapAdvIBHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "fastSL", {
        name: "SETTINGS.FastSL",
        hint: "SETTINGS.FastSLHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "testAbove100", {
        name: "SETTINGS.TestsAbove100",
        hint: "SETTINGS.TestsAbove100Hint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "criticalsFumblesOnAllTests", {
        name: "SETTINGS.CriticalsFumblesAllTests",
        hint: "SETTINGS.CriticalsFumblesAllTestsHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "extendedTests", {
        name: "SETTINGS.ExtendedTests",
        hint: "SETTINGS.ExtendedTestsHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "channelingNegativeSLTests", {
        name: "SETTINGS.ChannelingNegativeSL",
        hint: "SETTINGS.ChannelingNegativeSLHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "limitEquippedWeapons", {
        name: "SETTINGS.LimitEquippedWeapons",
        hint: "SETTINGS.LimitEquippedWeaponsHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "autoFillAdvantage", {
        name: "SETTINGS.AutoFillAdv",
        hint: "SETTINGS.AutoFillAdvHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "testDefaultDifficulty", {
        name: "SETTINGS.TestDialogDefaultDifficulty",
        hint: "SETTINGS.TestDialogDefaultDifficultyHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "displayRoundSummary", {
        name: "SETTINGS.RoundSummary",
        hint: "SETTINGS.RoundSummaryHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "statusOnTurnStart", {
        name: "SETTINGS.StatusTurnStart",
        hint: "SETTINGS.StatusTurnStartHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "focusOnTurnStart", {
        name: "SETTINGS.FocusTurnStart",
        hint: "SETTINGS.FocusTurnStartHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "hideTestData", {
        name: "SETTINGS.HideTestData",
        hint: "SETTINGS.HideTestDataHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "manualChatCards", {
        name: "SETTINGS.ManualChatCards",
        hint: "SETTINGS.ManualChatCardsHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "weaponLength", {
        name: "SETTINGS.WeaponLength",
        hint: "SETTINGS.WeaponLengthHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "rangeAutoCalculation", {
        name: "SETTINGS.RangeAutoCalculation",
        hint: "SETTINGS.RangeAutoCalculationHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "playerBrowser", {
        name: "SETTINGS.PlayerBrowser",
        hint: "SETTINGS.PlayerBrowserHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "playerExperienceEditing", {
        name: "SETTINGS.PlayerExperienceEditing",
        hint: "SETTINGS.PlayerExperienceEditingHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "soundPath", {
        name: "SETTINGS.SoundEffects",
        hint: "SETTINGS.SoundEffectsHint",
        scope: "world",
        config: true,
        default: "systems/wfrp4e/sounds/",
        type: String
      });
      game.settings.register("wfrp4e", "customCursor", {
        name: "SETTINGS.CustomCursor",
        hint: "SETTINGS.CustomCursorHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "throwMoney", {
        name: "SETTINGS.ThrowMoney",
        hint: "SETTINGS.ThrowMoneyHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
      });
      game.settings.register("wfrp4e", "advantageBonus", {
        name: "SETTINGS.AdvantageBonus",
        hint: "SETTINGS.AdvantageBonusHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: 10,
        type: Number
      });
      game.settings.register("wfrp4e", "dangerousCrits", {
        name: "SETTINGS.DangerousCrits",
        hint: "SETTINGS.DangerousCritsHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "dangerousCritsMod", {
        name: "SETTINGS.DangerousCritsMod",
        hint: "SETTINGS.DangerousCritsModHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: 10,
        type: Number
      });
      game.settings.register("wfrp4e", "tables", {
        scope: "world",
        config: false,
        default: {},
        type: Object
      });
      game.settings.register("wfrp4e", "bugReportName", {
        scope: "world",
        config: false,
        default: "",
        type: String
      });
      game.settings.register("wfrp4e", "tableVisibility", {
        scope: "world",
        config: false,
        default: {},
        type: Object
      });
      game.settings.register("wfrp4e", "tableRollMode", {
        scope: "client",
        config: false,
        default: {},
        type: Object
      });
      game.settings.register("wfrp4e", "useGroupAdvantage", {
        name: "SETTINGS.UseGroupAdvantage",
        hint: "SETTINGS.UseGroupAdvantageHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: debouncedReload
      });
      game.settings.register("wfrp4e", "groupAdvantageValues", {
        scope: "world",
        config: false,
        default: { players: 0, enemies: 0 },
        type: Object
      });
      game.settings.register("wfrp4e", "mooAdvantage", {
        name: "SETTINGS.MooAdvantage",
        hint: "SETTINGS.MooAdvantageHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooDifficulty", {
        name: "SETTINGS.MooDifficulty",
        hint: "SETTINGS.MooDifficultyHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooConditions", {
        name: "SETTINGS.MooConditions",
        hint: "SETTINGS.MooConditionsHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooConditionTriggers", {
        name: "SETTINGS.MooConditionTriggers",
        hint: "SETTINGS.MooConditionTriggersHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooCritModifiers", {
        name: "SETTINGS.MooCritModifiers",
        hint: "SETTINGS.MooCritMOdifiersHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooSLDamage", {
        name: "SETTINGS.MooSLDamage",
        hint: "SETTINGS.MooSLDamageHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooRangedDamage", {
        name: "SETTINGS.MooRangedDamage",
        hint: "SETTINGS.MooRangedDamageHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooMagicAdvantage", {
        name: "SETTINGS.MooMagicAdvantage",
        hint: "SETTINGS.MooMagicAdvantageHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooOvercasting", {
        name: "SETTINGS.MooOvercasting",
        hint: "SETTINGS.MooOvercastingHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooCatastrophicMiscasts", {
        name: "SETTINGS.MooCatastrophicMiscasts",
        hint: "SETTINGS.MooCatastrophicMiscastsHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "partialChannelling", {
        name: "SETTINGS.PartialChannelling",
        hint: "SETTINGS.PartialChannellingHint",
        scope: "world",
        homebrew: true,
        config: false,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooCriticalChannelling", {
        name: "SETTINGS.MooCriticalChannelling",
        hint: "SETTINGS.MooCriticalChannellingHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooCastAfterChannelling", {
        name: "SETTINGS.MooCastAfterChannelling",
        hint: "SETTINGS.MooCastAfterChannellingHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooPenetrating", {
        name: "SETTINGS.MooPenetrating",
        hint: "SETTINGS.MooPenetratingHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooQualities", {
        name: "SETTINGS.MooQualities",
        hint: "SETTINGS.MooQualitiesHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooShieldAP", {
        name: "SETTINGS.MooShieldAP",
        hint: "SETTINGS.MooShieldAPHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooCriticalMitigation", {
        name: "SETTINGS.MooCriticalMitigation",
        hint: "SETTINGS.MooCriticalMitigationHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooRangeBands", {
        name: "SETTINGS.MooRangeBands",
        hint: "SETTINGS.MooRangeBandsHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooSizeDamage", {
        name: "SETTINGS.MooSizeDamage",
        hint: "SETTINGS.MooSizeDamageHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "mooHomebrewItemChanges", {
        name: "SETTINGS.MooHomebrewItems",
        hint: "SETTINGS.MooHomebrewItemHint",
        scope: "world",
        config: false,
        homebrew: true,
        default: false,
        type: Boolean
      });
      game.settings.register("wfrp4e", "unofficialgrimoire", {
        name: "SETTINGS.UnofficialGrimoire",
        hint: "SETTINGS.UnofficialGrimoireHint",
        scope: "world",
        homebrew: true,
        config: false,
        default: false,
        type: Boolean
      });
      loadTemplates([
        "systems/wfrp4e/templates/actors/character/character-main.html",
        "systems/wfrp4e/templates/actors/actor-combat.html",
        "systems/wfrp4e/templates/actors/actor-effects.html",
        "systems/wfrp4e/templates/actors/actor-biography.html",
        "systems/wfrp4e/templates/actors/actor-inventory.html",
        "systems/wfrp4e/templates/actors/actor-skills.html",
        "systems/wfrp4e/templates/actors/actor-magic.html",
        "systems/wfrp4e/templates/actors/actor-religion.html",
        "systems/wfrp4e/templates/actors/actor-talents.html",
        "systems/wfrp4e/templates/actors/actor-notes.html",
        "systems/wfrp4e/templates/actors/npc/npc-careers.html",
        "systems/wfrp4e/templates/actors/creature/creature-main.html",
        "systems/wfrp4e/templates/actors/creature/creature-notes.html",
        "systems/wfrp4e/templates/actors/creature/creature-main.html",
        "systems/wfrp4e/templates/actors/vehicle/vehicle-main.html",
        "systems/wfrp4e/templates/actors/vehicle/vehicle-cargo.html",
        "systems/wfrp4e/templates/actors/vehicle/vehicle-description.html",
        "systems/wfrp4e/templates/actors/vehicle/vehicle-effects.html",
        "systems/wfrp4e/templates/partials/armour-location.html",
        "systems/wfrp4e/templates/partials/item-container.html",
        "systems/wfrp4e/templates/partials/qualities-flaws.html",
        "systems/wfrp4e/templates/partials/overcasts.html",
        "systems/wfrp4e/templates/dialog/dialog-constant.html",
        "systems/wfrp4e/templates/chat/roll/test-card.html",
        "systems/wfrp4e/templates/chat/help/chat-command-display-info.html",
        "systems/wfrp4e/templates/items/item-header.html",
        "systems/wfrp4e/templates/items/item-description.html",
        "systems/wfrp4e/templates/items/item-effects.html"
      ]);
      NameGenWfrp._loadNames();
      CONFIG.Morrslieb = new PIXI.filters.AdjustmentFilter({ green: 0.7137, red: 0.302, blue: 0.2275, morrslieb: true });
      CONFIG.MorrsliebObject = {
        color: { value: "#4cb53a", apply: true },
        gamma: 1,
        contrast: 1,
        brightness: 1,
        saturation: 0.2
      };
      CONFIG.fontDefinitions.CaslonAntique = { editor: true, fonts: [] };
      CONFIG.canvasTextStyle = new PIXI.TextStyle({
        fontFamily: "CaslonAntique",
        fontSize: 36,
        fill: "#FFFFFF",
        stroke: "#111111",
        strokeThickness: 1,
        dropShadow: true,
        dropShadowColor: "#000000",
        dropShadowBlur: 4,
        dropShadowAngle: 0,
        dropShadowDistance: 0,
        align: "center",
        wordWrap: false
      });
      game.wfrp4e.postReadyPrepare = [];
    });
  }

  // modules/system/overrides.js
  function overrides_default() {
    function fromCompendiumRetainID(document2) {
      let data = document2;
      if (document2 instanceof foundry.abstract.Document) {
        data = document2.toObject();
        if (!data.flags.core?.sourceId)
          foundry.utils.setProperty(data, "flags.core.sourceId", document2.uuid);
      }
      const deleteKeys = ["folder"];
      for (let k of deleteKeys) {
        delete data[k];
      }
      if ("sort" in data)
        data.sort = 0;
      if ("ownership" in data)
        data.ownership = { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
      return data;
    }
    Actors.prototype.fromCompendium = fromCompendiumRetainID;
    Items.prototype.fromCompendium = fromCompendiumRetainID;
    Journal.prototype.fromCompendium = fromCompendiumRetainID;
    Scenes.prototype.fromCompendium = fromCompendiumRetainID;
    RollTables.prototype.fromCompendium = fromCompendiumRetainID;
    let sceneToCompendium = CONFIG.Scene.documentClass.prototype.toCompendium;
    let journalToCompendium = CONFIG.JournalEntry.documentClass.prototype.toCompendium;
    let tableToCompendium = CONFIG.RollTable.documentClass.prototype.toCompendium;
    CONFIG.JournalEntry.documentClass.prototype.toCompendium = function(pack) {
      let data = journalToCompendium.bind(this)(pack);
      data._id = this.id;
      return data;
    };
    CONFIG.Scene.documentClass.prototype.toCompendium = function(pack) {
      let data = sceneToCompendium.bind(this)(pack);
      data._id = this.id;
      return data;
    };
    CONFIG.RollTable.documentClass.prototype.toCompendium = function(pack) {
      let data = tableToCompendium.bind(this)(pack);
      data._id = this.id;
      return data;
    };
    Combatant.prototype._getInitiativeFormula = function() {
      const actor = this.actor;
      let initiativeFormula = CONFIG.Combat.initiative.formula || game.system.initiative;
      if (!actor)
        return initiativeFormula;
      let args = { initiative: initiativeFormula };
      actor.runEffects("getInitiativeFormula", args);
      return args.initiative;
    };
    Token.prototype.drawEffects = async function() {
      this.effects.removeChildren().forEach((c) => c.destroy());
      this.effects.bg = this.effects.addChild(new PIXI.Graphics());
      this.effects.overlay = null;
      const tokenEffects = this.document.effects;
      const actorEffects = this.actor?.temporaryEffects || [];
      let overlay = {
        src: this.document.overlayEffect,
        tint: null
      };
      if (tokenEffects.length || actorEffects.length) {
        const promises = [];
        for (let f of actorEffects) {
          if (!f.icon)
            continue;
          const tint = Color.from(f.tint ?? null);
          if (f.getFlag("core", "overlay")) {
            overlay = { src: f.icon, tint };
            continue;
          }
          promises.push(this._drawEffect(f.icon, tint, getProperty(f, "flags.wfrp4e.value")));
        }
        for (let f of tokenEffects)
          promises.push(this._drawEffect(f, null));
        await Promise.all(promises);
      }
      this.effects.overlay = await this._drawOverlay(overlay.src, overlay.tint);
      this._refreshEffects();
    };
    Token.prototype._drawEffect = async function(src, tint, value) {
      if (!src)
        return;
      let tex = await loadTexture(src, { fallback: "icons/svg/hazard.svg" });
      let icon = new PIXI.Sprite(tex);
      if (tint)
        icon.tint = tint;
      if (value) {
        let text = new PreciseText(value, game.wfrp4e.config.effectTextStyle);
        text.x = icon.x + icon.width * 0.1;
        text.y = icon.y + icon.height * 0.05;
        text.scale.x = 20;
        text.scale.y = 20;
        icon.addChild(text);
      }
      return this.effects.addChild(icon);
    };
    TokenHUD.prototype._onToggleEffect = function(event2, { overlay = false } = {}) {
      event2.preventDefault();
      event2.stopPropagation();
      let img = event2.currentTarget;
      const effect = img.dataset.statusId && this.object.actor ? CONFIG.statusEffects.find((e) => e.id === img.dataset.statusId) : img.getAttribute("src");
      if (event2.button == 0)
        return this.object.incrementCondition(effect);
      if (event2.button == 2)
        return this.object.decrementCondition(effect);
    };
    Token.prototype.incrementCondition = async function(effect, { active, overlay = false } = {}) {
      const existing = this.actor.actorEffects.find((e) => e.getFlag("core", "statusId") === effect.id);
      if (!existing || Number.isNumeric(getProperty(existing, "flags.wfrp4e.value")))
        this.actor.addCondition(effect.id);
      else if (existing)
        this.actor.removeCondition(effect.id);
      if (this.hasActiveHUD)
        canvas.tokens.hud.refreshStatusIcons();
      return active;
    };
    Token.prototype.decrementCondition = async function(effect, { active, overlay = false } = {}) {
      this.actor.removeCondition(effect.id);
      if (this.hasActiveHUD)
        canvas.tokens.hud.refreshStatusIcons();
      return active;
    };
    NotesLayer.prototype._onDropData = async function(event2, data) {
      let entry;
      const coords = this._canvasCoordinatesFromDrop(event2);
      if (!coords)
        return false;
      const noteData = { x: coords[0], y: coords[1] };
      if (data.type === "JournalEntry")
        entry = await JournalEntry.implementation.fromDropData(data);
      if (data.type === "JournalEntryPage") {
        const page = await JournalEntryPage.implementation.fromDropData(data);
        entry = page.parent;
        noteData.pageId = page.id;
        noteData.flags = { anchor: data.anchor };
      }
      if (entry?.compendium) {
        const journalData = game.journal.fromCompendium(entry);
        entry = await JournalEntry.implementation.create(journalData);
      }
      noteData.entryId = entry?.id;
      return this._createPreview(noteData, { top: event2.clientY - 20, left: event2.clientX + 40 });
    };
    let _NoteConfigSubmitData = NoteConfig.prototype._getSubmitData;
    NoteConfig.prototype._getSubmitData = function(updateData = {}) {
      let data = _NoteConfigSubmitData.bind(this)(updateData);
      data["flags.anchor"] = this.object.flags.anchor;
      return data;
    };
  }

  // modules/system/migrations.js
  var Migration = class {
    static async migrateWorld() {
      ui.notifications.info(`Applying WFRP4e System Migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`, { permanent: true });
      for (let i of game.items.contents) {
        try {
          let updateData = Migration.migrateItemData(i.toObject());
          if (!foundry.utils.isEmpty(updateData)) {
            console.log(`Migrating Item document ${i.name}`);
            await i.update(updateData, { enforceTypes: false });
          }
        } catch (err) {
          err.message = `Failed wfrp4e system migration for Item ${i.name}: ${err.message}`;
          console.error(err);
        }
      }
      for (let p of game.packs) {
        if (p.metadata.type == "Item" && p.metadata.package == "world")
          await Migration.migrateCompendium(p);
      }
      for (let p of game.packs) {
        if (p.metadata.type == "Actor" && p.metadata.package == "world")
          await Migration.migrateCompendium(p);
      }
      for (let p of game.packs) {
        if (p.metadata.type == "Scene" && p.metadata.package == "world")
          await Migration.migrateCompendium(p);
      }
      for (let a of game.actors.contents) {
        try {
          let updateData = Migration.migrateActorData(a);
          if (!foundry.utils.isEmpty(updateData)) {
            console.log(`Migrating Actor document ${a.name}`);
            await a.update(updateData, { enforceTypes: false });
          }
        } catch (err) {
          err.message = `Failed wfrp4e system migration for Actor ${a.name}: ${err.message}`;
          console.error(err);
        }
      }
      for (let s of game.scenes.contents) {
        try {
          let updateData = Migration.migrateSceneData(s);
          if (!foundry.utils.isEmpty(updateData)) {
            console.log(`Migrating Scene document ${s.name}`);
            await s.update(updateData, { enforceTypes: false });
            s.tokens.contents.forEach((t) => t._actor = null);
          }
        } catch (err) {
          err.message = `Failed wfrp4e system migration for Scene ${s.name}: ${err.message}`;
          console.error(err);
        }
      }
      game.settings.set("wfrp4e", "systemMigrationVersion", game.system.version);
      ui.notifications.info(`wfrp4e System Migration to version ${game.system.version} completed!`, { permanent: true });
    }
    static async migrateCompendium(pack) {
      const document2 = pack.metadata.document;
      if (!["Actor", "Item", "Scene"].includes(document2))
        return;
      const wasLocked = pack.locked;
      await pack.configure({ locked: false });
      await pack.migrate();
      const documents = await pack.getDocuments();
      for (let doc of documents) {
        let updateData = {};
        try {
          switch (document2) {
            case "Actor":
              updateData = Migration.migrateActorData(doc);
              break;
            case "Item":
              updateData = Migration.migrateItemData(doc);
              break;
            case "Scene":
              updateData = Migration.migrateSceneData(doc);
              break;
          }
          if (foundry.utils.isEmpty(updateData))
            continue;
          await doc.update(updateData);
          console.log(`Migrated ${document2} document ${doc.name} in Compendium ${pack.collection}`);
        } catch (err) {
          err.message = `Failed wfrp4e system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
          console.error(err);
        }
      }
      await pack.configure({ locked: wasLocked });
      console.log(`Migrated all ${document2} entities from Compendium ${pack.collection}`);
    }
    static migrateActorData(actor) {
      let updateData = {};
      if (actor.items) {
        const items = actor.items.reduce((arr, i) => {
          let itemUpdate = Migration.migrateItemData(i);
          if (!isEmpty(itemUpdate)) {
            itemUpdate._id = i.id;
            arr.push(expandObject(itemUpdate));
          }
          return arr;
        }, []);
        if (items.length > 0)
          updateData.items = items;
      }
      if (actor.actorEffects) {
        const effects = actor.actorEffects.reduce((arr, e) => {
          let effectUpdate = Migration.migrateEffectData(e);
          if (!isEmpty(effectUpdate)) {
            effectUpdate._id = e.id;
            arr.push(expandObject(effectUpdate));
          }
          return arr;
        }, []);
        if (effects.length > 0)
          updateData.effects = effects;
      }
      return updateData;
    }
    static async migrateOwnedItemEffects(actor) {
      let itemsToRemove = [];
      let itemsToAdd = [];
      for (let item of actor.items) {
        if (item.getFlag("core", "sourceId")) {
          let source = item.getFlag("core", "sourceId");
          let newItem = item.toObject();
          let sourceItem = await fromUuid(source);
          if (sourceItem)
            sourceItem = sourceItem.toObject();
          if (sourceItem.name == item.name) {
            newItem.effects = sourceItem.effects;
            itemsToRemove.push(item.id);
            itemsToAdd.push(newItem);
          }
        }
      }
      await actor.deleteEmbeddedDocuments("Item", itemsToRemove);
      await actor.createEmbeddedDocuments("Item", itemsToAdd, { keepId: true });
      console.log(`Replaced Items ${itemsToAdd.map((i) => i.name).join(", ")} for actor ${actor.name}`);
    }
    static cleanActorData(actorData) {
      const model = game.system.model.Actor[actorData.type];
      actorData.data = filterObject(actorData.data, model);
      const allowedFlags = CONFIG.wfrp4e.allowedActorFlags.reduce((obj, f) => {
        obj[f] = null;
        return obj;
      }, {});
      if (actorData.flags.wfrp4e) {
        actorData.flags.wfrp4e = filterObject(actorData.flags.wfrp4e, allowedFlags);
      }
      return actorData;
    }
    static migrateArmourData(item) {
      let updateData = {};
      if (item.type == "armour" && item.system.currentAP) {
        updateData["system.AP"] = duplicate(item.system.maxAP);
        updateData["system.APdamage"] = duplicate(item.system.currentAP);
        updateData["system.-=currentAP"] = null;
        for (let loc in item.system.currentAP) {
          if (item.system.currentAP[loc] == -1)
            updateData["system.APdamage"][loc] = 0;
          else {
            updateData["system.APdamage"][loc] = item.system.maxAP[loc] - item.system.currentAP[loc];
          }
        }
      }
      return updateData;
    }
    static migrateItemData(item) {
      let updateData = {};
      if (item.type == "armour") {
        updateData = Migration.migrateArmourData(item);
      }
      if (item.effects) {
        const effects = item.effects.reduce((arr, e) => {
          let effectUpdate = Migration.migrateEffectData(e);
          if (!isEmpty(effectUpdate)) {
            effectUpdate._id = e.id;
            arr.push(expandObject(effectUpdate));
          }
          return arr;
        }, []);
        if (effects.length > 0)
          updateData.effects = effects;
      }
      if (!isEmpty(updateData))
        console.log("Migration data for " + item.name, updateData);
      return updateData;
    }
    static migrateEffectData(effect) {
      let updateData = {};
      Migration._migrateEffectScript(effect, updateData);
      if (!isEmpty(updateData))
        console.log("Migration data for " + effect.label, updateData);
      return updateData;
    }
    static migrateSceneData(scene) {
      const tokens = scene.tokens.map((token) => {
        const t = token.toJSON();
        if (!t.actorId || t.actorLink) {
          t.actorData = {};
        } else if (!game.actors.has(t.actorId)) {
          t.actorId = null;
          t.actorData = {};
        } else if (!t.actorLink) {
          const actorData = duplicate(t.actorData);
          actorData.type = token.actor?.type;
          const update = Migration.migrateActorData(actorData);
          ["items", "effects"].forEach((embeddedName) => {
            if (!update[embeddedName]?.length)
              return;
            const updates = new Map(update[embeddedName].map((u) => [u._id, u]));
            t.actorData[embeddedName].forEach((original) => {
              const update2 = updates.get(original._id);
              if (update2)
                mergeObject(original, update2);
            });
            delete update[embeddedName];
          });
          mergeObject(t.actorData, update);
        }
        return t;
      });
      return { tokens };
    }
    static _migrateEffectScript(effect, updateData) {
      let script = effect.script;
      if (!script)
        return updateData;
      script = script.replaceAll("actor.data.token", "actor.prototypeToken");
      script = script.replaceAll("actor.data", "actor");
      if (script != effect.script)
        updateData["flags.wfrp4e.script"] = script;
      return updateData;
    }
  };

  // modules/system/socket-handlers.js
  var SocketHandlers = class {
    static morrslieb(data) {
      canvas.draw();
    }
    static target(data) {
      if (!game.user.isUniqueGM)
        return;
      let scene = game.scenes.get(data.payload.scene);
      let token = scene.tokens.get(data.payload.target);
      token.actor.update(
        {
          "flags.oppose": data.payload.opposeFlag
        }
      );
    }
    static updateMsg(data) {
      if (!game.user.isUniqueGM)
        return;
      game.messages.get(data.payload.id).update(data.payload.updateData);
    }
    static deleteMsg(data) {
      if (!game.user.isUniqueGM)
        return;
      game.messages.get(data.payload.id).delete();
    }
    static applyEffects(data) {
      if (!game.user.isUniqueGM)
        return;
      game.wfrp4e.utility.applyEffectToTarget(data.payload.effect, data.payload.targets.map((t) => new TokenDocument(t, { parent: game.scenes.get(data.payload.scene) })));
    }
    static applyOneTimeEffect(data) {
      if (game.user.id != data.payload.userId)
        return;
      ui.notifications.notify("Received Apply Effect command for " + data.payload.effect.label);
      let actor = new ActorWfrp4e(data.payload.actorData);
      let effect = new EffectWfrp4e(data.payload.effect);
      try {
        let func = new Function("args", effect.script).bind({ actor, effect });
        func({ actor });
      } catch (ex) {
        ui.notifications.error("Error when running effect " + effect.label + ", please see the console (F12)");
        console.error("Error when running effect " + effect.label + " - If this effect comes from an official module, try replacing the actor/item from the one in the compendium. If it still throws this error, please use the Bug Reporter and paste the details below, as well as selecting which module and 'Effect Report' as the label.");
        console.error(`REPORT
-------------------
EFFECT:	${effect.label}
ACTOR:	${actor.name} - ${actor.id}
ERROR:	${ex}`);
      }
    }
    static changeGroupAdvantage(data) {
      if (!game.user.isGM || !game.settings.get("wfrp4e", "useGroupAdvantage"))
        return;
      let advantage = game.settings.get("wfrp4e", "groupAdvantageValues");
      advantage.players = data.payload.players;
      game.settings.set("wfrp4e", "groupAdvantageValues", advantage);
    }
  };

  // modules/system/moo-house.js
  function moo_house_default() {
    let config = game.wfrp4e.config;
    if (game.settings.get("wfrp4e", "mooDifficulty")) {
      config.difficultyModifiers["veasy"] = 40;
      config.difficultyModifiers["easy"] = 30;
      config.difficultyModifiers["average"] = 20;
      config.difficultyModifiers["challenging"] = 0;
      config.difficultyModifiers["difficult"] = -20;
      config.difficultyModifiers["hard"] = -30;
      config.difficultyModifiers["vhard"] = -40;
      config.difficultyLabels["veasy"] = game.i18n.localize("DIFFICULTY.MooVEasy");
      config.difficultyLabels["easy"] = game.i18n.localize("DIFFICULTY.MooEasy");
      config.difficultyLabels["average"] = game.i18n.localize("DIFFICULTY.Average");
      config.difficultyLabels["challenging"] = game.i18n.localize("DIFFICULTY.Challenging");
      config.difficultyLabels["difficult"] = game.i18n.localize("DIFFICULTY.MooDifficult");
      config.difficultyLabels["hard"] = game.i18n.localize("DIFFICULTY.MooHard");
      config.difficultyLabels["vhard"] = game.i18n.localize("DIFFICULTY.MooVHard");
      if (config.difficultyModifiers["futile"]) {
        config.difficultyLabels["futile"] = game.i18n.localize("DIFFICULTY.MooFutile");
        config.difficultyModifiers["futile"] = -50;
        config.difficultyLabels["impossible"] = game.i18n.localize("DIFFICULTY.MooImpossible");
        config.difficultyModifiers["impossible"] = -60;
      }
    }
    if (game.settings.get("wfrp4e", "mooConditions")) {
      config.conditionDescriptions["prone"] += game.i18n.localize("MOO.Prone");
      config.conditionDescriptions["broken"] = game.i18n.localize("MOO.Broken");
      config.conditionDescriptions["bleeding"] = game.i18n.localize("MOO.Bleeding");
    }
    if (game.settings.get("wfrp4e", "mooConditionTriggers")) {
      config.statusEffects.forEach((e) => {
        if (e.flags.wfrp4e.trigger == "endRound")
          e.flags.wfrp4e.trigger = "endTurn";
      });
      config.conditionDescriptions.bleeding = config.conditionDescriptions.bleeding.replace("Round", "Turn");
      config.conditionDescriptions.bleeding = config.conditionDescriptions.bleeding.replace("Round", "Turn");
      config.conditionDescriptions.poisoned = config.conditionDescriptions.poisoned.replace("Round", "Turn");
      config.conditionDescriptions.ablaze = config.conditionDescriptions.ablaze.replace("Round", "Turn");
    }
    if (game.settings.get("wfrp4e", "mooPenetrating")) {
      config.propertyHasValue.penetrating = true;
      config.qualityDescriptions.penetrating = game.i18n.localize("MOO.Penetrating");
    }
    if (game.settings.get("wfrp4e", "mooQualities")) {
      config.weaponQualities.simple = game.i18n.localize("Simple");
      config.qualityDescriptions.simple = game.i18n.localize("MOO.Simple");
      config.propertyHasValue.simple = false;
      config.weaponQualities.momentum = game.i18n.localize("Momentum");
      config.qualityDescriptions.momentum = game.i18n.localize("MOO.Momentum");
      config.propertyHasValue.momentum = true;
    }
    if (game.settings.get("wfrp4e", "mooHomebrewItemChanges")) {
      fetch("systems/wfrp4e/moo/items.json").then((r) => r.json()).then(async (records) => {
        for (let id in records) {
          let data = records[id];
          try {
            let item = await fromUuid(id);
            if (item) {
              item.updateSource(data);
              game.wfrp4e.utility.logHomebrew("mooHomebrewItemChanges: " + id + ` (${item.name})`);
            }
          } catch {
            game.wfrp4e.utility.log("Could not find item " + id);
          }
        }
        game.wfrp4e.utility.log("Compendium changes will revert if homebrew items is deactivated and the game is refreshed");
      });
      if (game.user.isGM) {
        ui.notifications.notify(game.i18n.localize("MOO.Items"));
      }
    }
  }

  // modules/hooks/ready.js
  function ready_default() {
    Hooks.on("ready", async () => {
      Object.defineProperty(game.user, "isUniqueGM", {
        get: function() {
          return game.user.id == game.users.find((u) => u.active && u.isGM)?.id;
        }
      });
      CONFIG.ChatMessage.documentClass.prototype.getTest = function() {
        if (hasProperty(this, "flags.testData"))
          return game.wfrp4e.rolls.TestWFRP.recreate(this.flags.testData);
      };
      CONFIG.ChatMessage.documentClass.prototype.getOppose = function() {
        if (hasProperty(this, "flags.wfrp4e.opposeData"))
          return new OpposedWFRP(getProperty(this, "flags.wfrp4e.opposeData"));
      };
      CONFIG.ChatMessage.documentClass.prototype.getOpposedTest = function() {
        if (hasProperty(this, "flags.wfrp4e.opposeTestData"))
          return OpposedTest.recreate(getProperty(this, "flags.wfrp4e.opposeTestData"));
      };
      let activeModules = game.settings.get("core", "moduleConfiguration");
      for (let m in activeModules) {
        if (activeModules[m]) {
          try {
            await WFRP_Utility.loadTablesPath(`modules/${m}/tables`);
          } catch {
          }
        }
      }
      try {
        await WFRP_Utility.loadTablesPath(`worlds/${game.world.id}/tables`);
      } catch {
      }
      if (game.settings.get("wfrp4e", "customCursor")) {
        WFRP_Utility.log("Using custom cursor", true);
        if (await srcExists("systems/wfrp4e/ui/cursors/pointer.png")) {
          let link = document.createElement("link");
          link.setAttribute("rel", "stylesheet");
          link.type = "text/css";
          link.href = "/systems/wfrp4e/css/cursor.css";
          document.head.appendChild(link);
        } else {
          WFRP_Utility.log("No custom cursor found", true);
        }
      }
      if (game.settings.get("wfrp4e", "useGroupAdvantage", true) && game.user.isGM && game.settings.get("wfrp4e", "autoFillAdvantage", true)) {
        ui.notifications.notify(game.i18n.localize("AutoFillAdvantageDisabled"), { permanent: true });
        game.settings.set("wfrp4e", "autoFillAdvantage", false);
      }
      game.socket.on("system.wfrp4e", (data) => {
        SocketHandlers[data.type](data);
      });
      const body = $("body");
      body.on("dragstart", "a.condition-chat", WFRP_Utility._onDragConditionLink);
      const MIGRATION_VERSION = 6;
      let needMigration = isNewerVersion(MIGRATION_VERSION, game.settings.get("wfrp4e", "systemMigrationVersion"));
      if (needMigration && game.user.isGM) {
        game.wfrp4e.migration.migrateWorld();
      }
      game.settings.set("wfrp4e", "systemMigrationVersion", MIGRATION_VERSION);
      for (let e of game.wfrp4e.postReadyPrepare)
        e.prepareData();
      game.wfrp4e.config.PrepareSystemItems();
      CONFIG.statusEffects = game.wfrp4e.config.statusEffects;
      overrides_default();
      moo_house_default();
      canvas.tokens.placeables.forEach((t) => t.drawEffects());
      game.wfrp4e.tags.createTags();
      let coreVersion = game.modules.get("wfrp4e-core")?.version;
      if (coreVersion == "1.11") {
        new Dialog({
          title: "WFRP4e Core Module Update",
          content: `<p><b>Please Read:</b> Your WFRP4e Core Module is out of date. Due to an error on my part, Foundry doesn't recognize the update. This means you'll need to uninstall and reinstall the module from the Foundry Main Menu. This should have no effect on your imported Core Content, however it is recommended you reinitialize to get the fixes. After reinstalling it, you should have version 1.2.0<br><br>To read more about the update, see <a href="https://github.com/moo-man/WFRP4e-FoundryVTT/releases/tag/3.3.0">Release Notes</a><br><br>Apologies for the inconvenience,<br>Moo Man</p>`,
          buttons: {
            ok: {
              label: "Ok"
            }
          }
        }).render(true);
      }
      if (game.version == "0.8.9") {
        new Dialog({
          title: "Please Read",
          content: `<p><b>I can't remove [Item/Effect/Condition], I get an error "The key ------------- does not exist in the EmbeddedCollection Collection"</b><br><br>This is an unfortunate state of Foundry 0.8 that, to fix, would require a lot of changes to the Effect system, both in the handling of effects and specific effect scripts.<br><br>I'm electing to <b>not</b> do this, and instead wait for the database changes in Foundry V9 which will fix this problem.<br><br>V9 seems like a fairly far way away though, which sucks, so this may change, but that's how it is right now.<br><br>The document that you can't remove will be removed upon refresh. This dialog will continue to show on start-up for the time being to ensure visibility.<br><br>Apologies for the inconvenience,<br>Moo Man</p>`,
          buttons: {
            ok: {
              label: "Ok"
            }
          }
        }).render(true);
      }
    });
  }

  // modules/system/passengerRender.js
  function passengerRender_default() {
    canvas.tokens.placeables.forEach((token) => {
      let passengerIconSize = canvas.dimensions.size / 3.3333;
      let rowSize = 3;
      let colSize = 3;
      if (token.actor && token.actor.type == "vehicle") {
        let container = new PIXI.Container();
        let imgCount = 0;
        if (token.actor.passengers.length > 9) {
          passengerIconSize = canvas.dimensions.size / 4;
          rowSize = 4;
          colSize = 4;
        }
        passengerIconSize *= token.document.width;
        for (let img of token.actor.passengers.map((p) => p.actor?.prototypeToken?.texture.src)) {
          if (!img)
            continue;
          let sp = PIXI.Sprite.from(img);
          sp.width = passengerIconSize;
          sp.height = passengerIconSize;
          sp.x = passengerIconSize * (imgCount % rowSize);
          sp.y = passengerIconSize * Math.floor(imgCount / colSize);
          container.addChild(sp);
          imgCount++;
          if (imgCount > 9)
            break;
        }
        token.addChild(container);
      }
    });
  }

  // modules/apps/tokenHUD.js
  var WFRPTokenHUD = class extends TokenHUD {
    activateListeners(html) {
      html.find(".status-effects").off("click", ".effect-control", this._onToggleEffect.bind(this)).off("contextmenu", ".effect-control", (event2) => this._onToggleEffect(event2, { overlay: true }));
    }
  };

  // modules/hooks/canvas.js
  function canvas_default() {
    Hooks.on("canvasInit", (canvas2) => {
      SquareGrid.prototype.measureDistances = function(segments, options = {}) {
        if (!options.gridSpaces)
          return BaseGrid.prototype.measureDistances(segments, options);
        let nDiagonal = 0;
        const rule = this.parent.diagonalRule;
        const d = canvas2.dimensions;
        return segments.map((s) => {
          let r = s.ray;
          let nx = Math.abs(Math.ceil(r.dx / d.size));
          let ny = Math.abs(Math.ceil(r.dy / d.size));
          let nd = Math.min(nx, ny);
          let ns = Math.abs(ny - nx);
          nDiagonal += nd;
          let nd10 = Math.floor(nDiagonal / 2) - Math.floor((nDiagonal - nd) / 2);
          let spaces = nd10 * 2 + (nd - nd10) + ns;
          return spaces * canvas2.dimensions.distance;
        });
      };
    });
    Hooks.on("canvasReady", (canvas2) => {
      if (!(game.modules.get("fxmaster") && game.modules.get("fxmaster").active)) {
        let morrsliebActive = canvas2.scene.getFlag("wfrp4e", "morrslieb");
        if (morrsliebActive) {
          if (!canvas2.primary.filters)
            canvas2.primary.filters = [];
          canvas2.primary.filters.push(CONFIG.Morrslieb);
        } else if (canvas2.primary.filters?.length) {
          canvas2.primary.filters = canvas2.primary.filters.filter((i) => !i.morrslieb);
        }
      }
      passengerRender_default();
    });
  }

  // modules/apps/char-gen.js
  var GeneratorWfrp4e = class {
    constructor() {
      this.species;
      this.speciesExp = 0;
      this.attributeExp = 0;
      this.careerExp = 0;
      this.subspecies;
    }
    static start() {
      game.wfrp4e.generator = new this();
    }
    speciesStage() {
      if (!game.wfrp4e.config.species)
        return ui.notifications.error("No content found");
      renderTemplate("systems/wfrp4e/templates/chat/chargen/species-select.html", { species: game.wfrp4e.config.species }).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html);
        ChatMessage.create(chatData);
      });
    }
    async rollSpecies(messageId, chosenSpecies) {
      let roll;
      if (chosenSpecies) {
        this.speciesExp = 0;
        roll = { roll: game.i18n.localize("Choose"), species: chosenSpecies, name: game.wfrp4e.config.species[chosenSpecies] };
      } else {
        this.speciesExp = 20;
        roll = await game.wfrp4e.tables.rollTable("species");
      }
      this.species = roll.species;
      let speciesMessage = game.messages.get(messageId);
      let updateCardData = { roll, species: game.wfrp4e.config.species };
      renderTemplate("systems/wfrp4e/templates/chat/chargen/species-select.html", updateCardData).then((html) => {
        speciesMessage.update({ content: html });
      });
      if (game.wfrp4e.config.subspecies[roll.species]) {
        return renderTemplate("systems/wfrp4e/templates/chat/chargen/subspecies-select.html", { species: roll.species, speciesDisplay: game.wfrp4e.config.species[roll.species], subspecies: game.wfrp4e.config.subspecies[roll.species] }).then((html) => {
          let chatData = WFRP_Utility.chatDataSetup(html);
          ChatMessage.create(chatData);
        });
      }
      this.rollAttributes();
    }
    chooseSubspecies(subspecies) {
      this.subspecies = subspecies;
      this.rollAttributes();
    }
    async rollAttributes(reroll = false) {
      let species = this.species;
      let characteristics = await WFRP_Utility.speciesCharacteristics(species, false, this.subspecies);
      if (reroll) {
        this.attributeExp = 0;
      } else
        this.attributeExp = 50;
      let dataTransfer = {
        type: "generation",
        generationType: "attributes",
        payload: {
          species,
          subspecies: this.subspecies,
          characteristics,
          movement: game.wfrp4e.config.speciesMovement[species],
          fate: game.wfrp4e.config.speciesFate[species],
          resilience: game.wfrp4e.config.speciesRes[species],
          exp: this.attributeExp + this.speciesExp
        }
      };
      let cardData = duplicate(dataTransfer.payload);
      cardData.characteristics = {};
      for (let abrev in game.wfrp4e.config.characteristicsAbbrev) {
        cardData.characteristics[game.wfrp4e.config.characteristicsAbbrev[abrev]] = dataTransfer.payload.characteristics[abrev];
      }
      cardData.speciesKey = species;
      cardData.species = game.wfrp4e.config.species[species];
      if (this.subspecies)
        cardData.species += ` (${game.wfrp4e.config.subspecies[species][this.subspecies].name})`;
      cardData.extra = game.wfrp4e.config.speciesExtra[species];
      cardData.move = game.wfrp4e.config.speciesMovement[species];
      renderTemplate("systems/wfrp4e/templates/chat/chargen/attributes.html", cardData).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html);
        chatData["flags.transfer"] = JSON.stringify(dataTransfer);
        ChatMessage.create(chatData);
      });
    }
    async speciesSkillsTalents() {
      let species = this.species;
      let { skills, talents } = WFRP_Utility.speciesSkillsTalents(this.species, this.subspecies);
      let cardData = {
        speciesKey: species,
        species: game.wfrp4e.config.species[species],
        speciesSkills: skills
      };
      let speciesTalents = [];
      let choiceTalents = [];
      talents.forEach((talent) => {
        if (isNaN(talent)) {
          let talentList = talent.split(",").map((i) => i.trim());
          if (talentList.length == 1)
            speciesTalents.push(talentList[0]);
          else
            choiceTalents.push(talentList);
        }
      });
      let randomTalents = talents[talents.length - 1];
      cardData.randomTalents = [];
      for (let i = 0; i < randomTalents; i++) {
        let talent = await game.wfrp4e.tables.rollTable("talents");
        cardData.randomTalents.push({ name: talent.result, roll: talent.roll });
      }
      cardData.speciesTalents = speciesTalents;
      cardData.choiceTalents = choiceTalents;
      renderTemplate("systems/wfrp4e/templates/chat/chargen/species-skills-talents.html", cardData).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html);
        ChatMessage.create(chatData);
      });
    }
    async rollCareer(isReroll = false) {
      this.careerExp = 0;
      if (isReroll)
        this.careerExp = game.wfrp4e.config.randomExp.careerReroll;
      else
        this.careerExp = game.wfrp4e.config.randomExp.careerRand;
      let rollSpecies = this.species;
      if (this.species == "human" && !this.subspecies)
        this.subspecies = "reiklander";
      if (this.subspecies && game.wfrp4e.tables.findTable("career", rollSpecies + "-" + this.subspecies))
        rollSpecies += "-" + this.subspecies;
      let roll = await game.wfrp4e.tables.rollTable("career", {}, rollSpecies);
      this.displayCareer(roll.object.text, isReroll);
    }
    async chooseCareer() {
      let msgContent = `<h2>${game.i18n.localize("CHAT.CareerChoose")}</h2>`;
      let rollSpecies = this.species;
      let table = game.wfrp4e.tables.findTable("career", rollSpecies);
      if (this.subspecies && game.wfrp4e.tables.findTable("career", rollSpecies + "-" + this.subspecies)) {
        rollSpecies += "-" + this.subspecies;
        table = game.wfrp4e.tables.findTable("career", rollSpecies);
      }
      for (let r of table.results) {
        msgContent += `<a class="career-select" data-career="${r.text}" data-species="${this.species}">${r.text}</a><br>`;
      }
      let chatData = WFRP_Utility.chatDataSetup(msgContent);
      ChatMessage.create(chatData);
    }
    async displayCareer(careerName, isReroll, isChosen) {
      let packs = game.wfrp4e.tags.getPacksWithTag("career");
      let careers = game.items.filter((i) => i.type == "career");
      let careerFound;
      for (let pack of packs)
        careers = careers.concat((await pack.getDocuments()).filter((i) => i.type == "career"));
      for (let c of careers) {
        if (c.system.careergroup.value == careerName && c.system.level.value == 1)
          careerFound = c;
        if (careerFound)
          break;
      }
      if (!careerFound)
        return ui.notifications.error(`Career ${careerName} not found`);
      careerFound.postItem();
      let cardData = {
        exp: this.careerExp,
        reroll: isReroll,
        chosen: isChosen,
        speciesKey: this.species,
        trappings: game.wfrp4e.config.classTrappings[WFRP_Utility.matchClosest(game.wfrp4e.config.classTrappings, careerFound.system.class.value, { matchKeys: true })]
      };
      renderTemplate("systems/wfrp4e/templates/chat/chargen/career-select.html", cardData).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html);
        ChatMessage.create(chatData);
      });
    }
    async rollDetails(species) {
      species = species || this.species;
      let name, eyes, hair, heightRoll, hFeet, hInches, age;
      name = NameGenWfrp.generateName({ species });
      if (!name)
        name = species + " names TBD";
      eyes = (await game.wfrp4e.tables.rollTable("eyes", {}, species)).result;
      hair = (await game.wfrp4e.tables.rollTable("hair", {}, species)).result;
      age = (await new Roll(game.wfrp4e.config.speciesAge[species]).roll()).total;
      heightRoll = (await new Roll(game.wfrp4e.config.speciesHeight[species].die).roll()).total;
      hFeet = game.wfrp4e.config.speciesHeight[species].feet;
      hInches = game.wfrp4e.config.speciesHeight[species].inches + heightRoll;
      hFeet += Math.floor(hInches / 12);
      hInches = hInches % 12;
      let dataTransfer = {
        type: "generation",
        generationType: "details",
        payload: {
          name,
          eyes,
          hair,
          age,
          height: `${hFeet}'${hInches}`
        }
      };
      let cardData = {
        species: game.wfrp4e.config.species[species],
        name,
        eyes,
        hair,
        age,
        height: `${hFeet}'${hInches}`
      };
      renderTemplate(`systems/wfrp4e/templates/chat/chargen/details.html`, cardData).then((html) => {
        let chatData = WFRP_Utility.chatDataSetup(html);
        chatData["flags.transfer"] = JSON.stringify(dataTransfer);
        ChatMessage.create(chatData);
      });
    }
  };

  // modules/hooks/chat.js
  function chat_default() {
    Hooks.on("renderChatLog", (log, html, data) => {
      ChatWFRP.chatListeners(html);
    });
    Hooks.on("preCreateChatMessage", (msg) => {
      msg.updateSource({ "content": ChatWFRP.addEffectButtons(msg.content) });
    });
    Hooks.on("chatMessage", (html, content, msg) => {
      let rollMode = game.settings.get("core", "rollMode");
      if (["gmroll", "blindroll"].includes(rollMode))
        msg["whisper"] = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
      if (rollMode === "blindroll")
        msg["blind"] = true;
      let regExp;
      regExp = /(\S+)/g;
      let commands = content.match(regExp);
      let command = commands[0];
      function isAnAmountOfMoney(mayBeAnOption) {
        let gc = game.i18n.localize("MARKET.Abbrev.GC");
        let ss = game.i18n.localize("MARKET.Abbrev.SS");
        let bp = game.i18n.localize("MARKET.Abbrev.BP");
        let pattern = `^.*(\\d*${gc}|\\d*${ss}|\\d*${bp})$`;
        let regExp2 = RegExp(pattern);
        return regExp2.test(mayBeAnOption.toUpperCase());
      }
      function extractAmountAndOptionFromCommandLine(commands2) {
        let amount = void 0, optionInCommandLine = void 0;
        let mayBeAnOption = commands2[commands2.length - 1];
        if (typeof mayBeAnOption === "undefined") {
          return { amount, optionInCommandLine };
        }
        let isAnAmount = isAnAmountOfMoney(mayBeAnOption);
        if (isAnAmount) {
          amount = commands2.slice(1, commands2.length).join("");
          optionInCommandLine = game.wfrp4e.config.creditOptions.SPLIT;
        } else {
          amount = commands2.slice(1, commands2.length - 1).join("");
          optionInCommandLine = mayBeAnOption;
        }
        let option = getOption(optionInCommandLine);
        return { amount, option };
      }
      function getOption(optionInCommandLine) {
        return typeof optionInCommandLine == "undefined" ? game.wfrp4e.config.creditOptions.SPLIT : optionInCommandLine;
      }
      if (command === "/table") {
        if (commands.length === 1) {
          game.wfrp4e.tables.formatChatRoll("menu").then((text) => {
            if (!text)
              return;
            msg.content = text;
            msg.speaker = { alias: "Table Menu" };
            ChatMessage.create(msg);
          });
        } else {
          let modifier, column;
          if (!isNaN(commands[2])) {
            modifier = parseInt(commands[2]);
            column = commands[3];
          } else {
            modifier = parseInt(commands[3]), column = commands[2];
          }
          game.wfrp4e.tables.formatChatRoll(commands[1], { modifier }, column).then((text) => {
            if (!text)
              return;
            msg.content = text;
            ChatMessage.create(msg);
          });
        }
        return false;
      } else if (command === "/cond") {
        let conditionInput = commands[1].toLowerCase();
        let closest = WFRP_Utility.matchClosest(game.wfrp4e.config.conditions, conditionInput);
        if (!game.wfrp4e.config.conditionDescriptions) {
          ui.notifications.error("No content found");
          return false;
        }
        let description = game.wfrp4e.config.conditionDescriptions[closest];
        let name = game.wfrp4e.config.conditions[closest];
        msg.content = `<b>${name}</b><br>${description}`;
        ChatMessage.create(msg);
        return false;
      } else if (command === "/prop") {
        let propertyInput = commands[1].toLowerCase();
        let allProperties = game.wfrp4e.utility.allProperties();
        let closest = WFRP_Utility.matchClosest(game.wfrp4e.utility.allProperties(), propertyInput);
        let description = game.wfrp4e.config.qualityDescriptions[closest] || game.wfrp4e.config.flawDescriptions[closest];
        let name = allProperties[closest];
        msg.content = `<b>${name}</b><br>${description}`;
        ChatMessage.create(msg);
        return false;
      } else if (command === "/char") {
        GeneratorWfrp4e.start();
        game.wfrp4e.generator.speciesStage();
        return false;
      } else if (command === "/name") {
        let gender = (commands[2] || "").toLowerCase();
        let species = (commands[1] || "").toLowerCase();
        let name = NameGenWfrp.generateName({ species, gender });
        ChatMessage.create(WFRP_Utility.chatDataSetup(name));
        return false;
      } else if (command === "/avail") {
        let modifier = 0;
        let settlement = (commands[1] || "").toLowerCase();
        let rarity = (commands[2] || "").toLowerCase();
        if (!isNaN(commands[3])) {
          modifier = commands[3];
        }
        MarketWfrp4e.testForAvailability({ settlement, rarity, modifier });
        return false;
      } else if (command === "/pay") {
        let amount = commands[1];
        let player = commands[2];
        if (!game.user.isGM) {
          let actor = WFRP_Utility.getSpeaker(msg.speaker);
          let money = MarketWfrp4e.payCommand(amount, actor);
          if (money)
            actor.updateEmbeddedDocuments("Item", money);
        } else
          MarketWfrp4e.generatePayCard(amount, player);
        return false;
      } else if (command === "/credit") {
        let { amount, option } = extractAmountAndOptionFromCommandLine(commands);
        if (game.user.isGM) {
          MarketWfrp4e.generateCreditCard(amount, option);
        } else {
          message = `<p>${game.i18n.localize("MARKET.CreditCommandNotAllowed")}</p>`;
          ChatMessage.create(WFRP_Utility.chatDataSetup(message, "roll"));
        }
        return false;
      } else if (command === "/corruption") {
        WFRP_Utility.postCorruptionTest(commands[1]);
        return false;
      } else if (command === "/fear") {
        WFRP_Utility.postFear(commands[1], commands.slice(2).join(" "));
        return false;
      } else if (command === "/terror") {
        WFRP_Utility.postTerror(commands[1], commands.slice(2).join(" "));
        return false;
      } else if (command === "/exp") {
        WFRP_Utility.postExp(commands[1], commands.slice(2).join(" "));
        return false;
      } else if (command === "/travel") {
        TravelDistanceWfrp4e.displayTravelDistance(commands[1], commands[2]);
        return false;
      } else if (command === "/help") {
        let rawCommands = game.i18n.localize("CHAT.CommandLine.Help.Commands");
        let commandElements = rawCommands.split(",").map(function(item) {
          return {
            title: game.i18n.localize(`CHAT.CommandLine.Help.${item}.Title`),
            command: game.i18n.localize(`CHAT.CommandLine.Help.${item}.Usage.Command`),
            commandLabel: game.i18n.localize(`CHAT.CommandLine.Help.Label.Command`),
            example: game.i18n.localize(`CHAT.CommandLine.Help.${item}.Usage.Example`),
            exampleLabel: game.i18n.localize(`CHAT.CommandLine.Help.Label.Example`),
            note: game.i18n.localize(`CHAT.CommandLine.Help.${item}.Usage.Note`),
            noteLabel: game.i18n.localize(`CHAT.CommandLine.Help.Label.Note`)
          };
        });
        let link = game.i18n.format("CHAT.CommandLine.Help.Link", { link: "https://github.com/moo-man/WFRP4e-FoundryVTT/wiki" });
        renderTemplate("systems/wfrp4e/templates/chat/help/chat-help-command.html", {
          commands: commandElements,
          link
        }).then((html2) => {
          let chatData = WFRP_Utility.chatDataSetup(html2, "selfroll");
          ChatMessage.create(chatData);
        });
        return false;
      }
    });
    Hooks.on("renderChatMessage", async (app, html, msg) => {
      if (game.settings.get("wfrp4e", "hideTestData") && !game.user.isGM && html.find(".chat-card").attr("data-hide") === "true") {
        html.find(".hide-option").remove();
      }
      if (!game.user.isGM) {
        html.find(".chat-button-gm").remove();
        html.find(".unopposed-button").remove();
        html.find(".haggle-buttons").remove();
        html.find(".hide-spellcn").remove();
        if (msg.message.speaker.actor && game.actors.get(msg.message.speaker.actor).ownership != 3)
          html.find(".chat-button-player").remove();
      } else {
        html.find(".chat-button-player").remove();
      }
      if (html.hasClass("blind") && !game.user.isGM) {
        html.find(".message-header").remove();
        html.html("").css("display", "none");
      }
      let postedItem = html.find(".post-item")[0];
      if (postedItem) {
        postedItem.setAttribute("draggable", true);
        postedItem.classList.add("draggable");
        postedItem.addEventListener("dragstart", (ev) => {
          if (app.flags.postQuantity == "inf" || app.flags.postQuantity == void 0)
            return ev.dataTransfer.setData("text/plain", app.flags.transfer);
          if (game.user.isGM) {
            ev.dataTransfer.setData("text/plain", app.flags.transfer);
            let newQuantity = app.flags.postQuantity - 1;
            let recreateData = app.flags.recreationData;
            recreateData.postQuantity = newQuantity;
            renderTemplate("systems/wfrp4e/templates/chat/post-item.html", recreateData).then((html2) => {
              app.update({ "flags.postQuantity": newQuantity, content: TextEditor.enrichHTML(html2) });
              if (newQuantity <= 0)
                app.delete();
            });
          } else {
            let newQuantity = app.flags.postQuantity - 1;
            if (app.flags.postQuantity)
              ev.dataTransfer.setData("text/plain", app.flags.transfer);
            if (newQuantity == 0) {
              game.socket.emit("system.wfrp4e", {
                type: "deleteMsg",
                payload: {
                  "id": app.id
                }
              });
              return false;
            } else {
              ev.dataTransfer.setData("text/plain", app.flags.transfer);
              let recreateData = app.flags.recreationData;
              recreateData.postQuantity = newQuantity;
              renderTemplate("systems/wfrp4e/templates/chat/post-item.html", recreateData).then((html2) => {
                game.socket.emit("system.wfrp4e", {
                  type: "updateMsg",
                  payload: {
                    "id": app.id,
                    "updateData": { "flags.postQuantity": newQuantity, content: TextEditor.enrichHTML(html2) }
                  }
                });
              });
            }
          }
        });
      }
      let woundsHealed = html.find(".wounds-healed-drag")[0];
      if (woundsHealed) {
        woundsHealed.setAttribute("draggable", true);
        woundsHealed.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "wounds",
            payload: app.flags.testData.result.woundsHealed
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      }
      let generation = html.find(".char-gen")[0];
      if (generation) {
        generation.setAttribute("draggable", true);
        generation.addEventListener("dragstart", (ev) => {
          ev.dataTransfer.setData("text/plain", app.flags.transfer);
        });
      }
      html.find(".skill-drag").each(function() {
        let skill = $(this)[0];
        skill.setAttribute("draggable", true);
        skill.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "lookup",
            payload: {
              lookupType: "skill",
              name: ev.target.text
            }
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      });
      html.find(".talent-drag").each(function() {
        let talent = $(this)[0];
        talent.setAttribute("draggable", true);
        talent.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "lookup",
            payload: {
              lookupType: "talent",
              name: ev.target.text
            }
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      });
      html.find(".exp-drag").each(function() {
        let exp = $(this)[0];
        exp.setAttribute("draggable", true);
        exp.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "experience",
            payload: parseInt($(exp).attr("data-exp"))
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      });
      html.find(".money-drag").each(function() {
        let amount = $(this)[0];
        amount.setAttribute("draggable", true);
        amount.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "money",
            payload: $(amount).attr("data-amt")
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      });
      html.find(".item-lookup").each(function() {
        let item = $(this)[0];
        item.setAttribute("draggable", true);
        item.addEventListener("dragstart", (ev) => {
          let dataTransfer = {
            type: "lookup",
            payload: {
              lookupType: $(ev.currentTarget).attr("data-type"),
              name: ev.target.text
            }
          };
          ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
        });
      });
    });
    Hooks.on("deleteChatMessage", (message2) => {
      let targeted = message2.flags.unopposeData;
      let manual = message2.flags.opposedStartMessage;
      if (!targeted && !manual)
        return;
      if (targeted) {
        let target = canvas.tokens.get(message2.flags.unopposeData.targetSpeaker.token);
        target.actor.update(
          {
            "flags.-=oppose": null
          }
        );
      }
      if (manual && !message2.flags.opposeResult && OpposedWFRP.attackerMessage) {
        OpposedWFRP.attackerMessage.update(
          {
            "flags.data.isOpposedTest": false
          }
        );
        OpposedWFRP.clearOpposed();
      }
      ui.notifications.notify(game.i18n.localize("ROLL.CancelOppose"));
    });
  }

  // modules/system/combat.js
  var _CombatHelpers = class {
    static combatChecks(combat, type) {
      _CombatHelpers.scripts[type].forEach((script) => {
        script(combat);
      });
    }
    static preUpdateCombat(combat, updateData) {
      if (!updateData.round && !updateData.turn)
        return;
      if (combat.round == 0 && combat.active) {
        _CombatHelpers.combatChecks(combat, "startCombat");
      }
      if (combat.round != 0 && combat.turns && combat.active) {
        if (combat.current.turn > -1 && combat.current.turn == combat.turns.length - 1) {
          _CombatHelpers.combatChecks(combat, "endRound");
        }
      }
      _CombatHelpers.combatChecks(combat, "endTurn");
    }
    static updateCombat(combat, updateData) {
      if (!updateData.round && !updateData.turn)
        return;
      if (combat.round != 0 && combat.turns && combat.active) {
        _CombatHelpers.combatChecks(combat, "startTurn");
      }
    }
    static endCombat(combat) {
      _CombatHelpers.combatChecks(combat, "endCombat");
    }
    static startTurnChecks(combat) {
      if (!game.user.isUniqueGM)
        return;
      let turn = combat.turns.find((t) => t.token.id == combat.current.tokenId);
      if (turn) {
        if (turn.actor.hasSystemEffect("dualwielder"))
          turn.actor.removeSystemEffect("dualwielder");
        if (game.settings.get("wfrp4e", "statusOnTurnStart"))
          turn.actor.displayStatus(combat.round, turn.name);
        if (game.settings.get("wfrp4e", "focusOnTurnStart")) {
          canvas.tokens.get(turn.token.id).control();
          canvas.tokens.cycleTokens(1, true);
        }
        turn.actor.runEffects("startTurn", combat);
      } else {
        console.warn("wfrp4e | No actor token found: %o.", combat);
      }
      WFRP_Audio.PlayContextAudio({ item: { type: "round" }, action: "change" });
    }
    static endCombatChecks(combat) {
      if (!game.user.isUniqueGM)
        return;
      let content = "";
      for (let script of _CombatHelpers.scripts.endCombatScripts) {
        let scriptResult = script(combat);
        if (scriptResult)
          content += scriptResult + "<br><br>";
      }
      if (content) {
        content = `<h2>${game.i18n.localize("CHAT.EndCombat")}</h3>` + content;
        ChatMessage.create({ content, whisper: ChatMessage.getWhisperRecipients("GM") });
      }
    }
    static checkFearTerror(combat) {
      if (!game.user.isUniqueGM)
        return;
      let fearCounters = [];
      let terrorCounters = [];
      for (let turn of combat.turns) {
        try {
          let fear = turn.actor.has(game.i18n.localize("CHAT.Fear"));
          if (fear)
            fearCounters.push({ name: turn.name, value: `@Fear[${fear.specification.value},${turn.name}]` });
          let terror = turn.actor.has(game.i18n.localize("CHAT.Terror"));
          if (terror)
            terrorCounters.push({ name: turn.name, value: `@Terror[${terror.specification.value},${turn.name}]` });
        } catch (e) {
          console.log(e);
        }
      }
      let msg = "";
      if (fearCounters.length || terrorCounters.length) {
        if (fearCounters.length)
          msg += `<h2>${game.i18n.localize("CHAT.Fear")}</h2>${fearCounters.map((f) => `<b>${f.name}</b> - ${f.value}`).join("<br>")}`;
        if (terrorCounters.length)
          msg += `<h2>${game.i18n.localize("CHAT.Terror")}</h2>${terrorCounters.map((t) => `<b>${t.name}</b> - ${t.value}`).join("<br>")}`;
      }
      msg += _CombatHelpers.checkSizeFearTerror(combat);
      if (msg)
        ChatMessage.create({ content: msg });
    }
    static checkSizeFearTerror(combat) {
      let sizeMap = {};
      let msg = "";
      for (let turn of combat.turns) {
        sizeMap[turn.name] = turn.actor.sizeNum;
      }
      for (let actor in sizeMap) {
        let size = sizeMap[actor];
        let smallerBy = {
          1: [],
          2: [],
          3: [],
          4: [],
          5: [],
          6: []
        };
        for (let otherActor in sizeMap) {
          if (otherActor == actor)
            continue;
          try {
            if (size > sizeMap[otherActor])
              smallerBy[size - sizeMap[otherActor]].push(otherActor);
          } catch (e) {
          }
        }
        if (smallerBy[1].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Fear[${1}, ${actor}]`, actor, target: smallerBy[1].join(", ") });
        if (smallerBy[2].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Terror[${2}, ${actor}]`, actor, target: smallerBy[2].join(", ") });
        if (smallerBy[3].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Terror[${3}, ${actor}]`, actor, target: smallerBy[3].join(", ") });
        if (smallerBy[4].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Terror[${4}, ${actor}]`, actor, target: smallerBy[4].join(", ") });
        if (smallerBy[5].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Terror[${5}, ${actor}]`, actor, target: smallerBy[5].join(", ") });
        if (smallerBy[6].length)
          msg += game.i18n.format("CHAT.CausesFear", { fear: `@Terror[${6}, ${actor}]`, actor, target: smallerBy[6].join(", ") });
        if (Object.values(smallerBy).some((list) => list.length)) {
          msg += "<br>";
        }
      }
      if (msg)
        msg = `<br><h2>${game.i18n.localize("Size")}</h2>${msg}`;
      return msg;
    }
    static checkCorruption(combat) {
      if (!game.user.isUniqueGM)
        return;
      let corruptionCounters = [];
      for (let turn of combat.turns) {
        let corruption = turn.actor.has(game.i18n.localize("NAME.Corruption"));
        if (corruption) {
          let existing = corruptionCounters.find((c) => c.type == corruption.specification.value);
          if (existing)
            existing.counter++;
          else
            corruptionCounters.push({ counter: 1, type: corruption.specification.value });
        }
      }
      let content = "";
      if (corruptionCounters.length) {
        content += `<h3><b>${game.i18n.localize("Corruption")}</b></h3>`;
        for (let corruption of corruptionCounters) {
          content += `${corruption.counter} ${corruption.type}<br>`;
        }
        content += game.i18n.localize("CHAT.CorruptionTest");
        content += `<br>@Corruption[Minor]<br>@Corruption[Moderate]<br>@Corruption[Major]`;
      }
      return content;
    }
    static checkInfection(combat) {
      if (!game.user.isUniqueGM)
        return;
      let minorInfections = combat.getFlag("wfrp4e", "minorInfections") || [];
      let content = "";
      if (minorInfections.length) {
        content += `<h3><b>${game.i18n.localize("Minor Infections")}</b></h3>${game.i18n.localize("CHAT.InfectionReminder")}<br>`;
        for (let actor of minorInfections) {
          content += `<br><b>${actor}</b>`;
        }
      }
      return content;
    }
    static checkDiseases(combat) {
      if (!game.user.isUniqueGM)
        return;
      let diseaseCounters = [];
      for (let turn of combat.turns) {
        let disease = turn.actor.has(game.i18n.localize("NAME.Disease"));
        if (disease) {
          let existing = diseaseCounters.find((d) => d.type == disease.specification.value);
          if (existing)
            existing.counter++;
          else
            diseaseCounters.push({ counter: 1, type: disease.specification.value });
        }
      }
      let content = "";
      if (diseaseCounters.length) {
        content += `<h3><b>${game.i18n.localize("Diseases")}</b></h3>`;
        for (let disease of diseaseCounters)
          content += `${disease.counter} <a class="item-lookup" data-type="disease" data-open="sheet">${disease.type}</a><br>`;
        content += game.i18n.localize("CHAT.DiseasesRules");
      }
      return content;
    }
    static checkEndRoundConditions(combat) {
      if (!game.user.isUniqueGM)
        return;
      let removedConditions = [];
      let msgContent = "";
      for (let turn of combat.turns) {
        let endRoundConditions = turn.actor.actorEffects.filter((e) => e.conditionTrigger == "endRound");
        for (let cond of endRoundConditions) {
          if (game.wfrp4e.config.conditionScripts[cond.statusId]) {
            let conditionName = game.i18n.localize(game.wfrp4e.config.conditions[cond.statusId]);
            if (Number.isNumeric(cond.flags.wfrp4e.value))
              conditionName += ` ${cond.flags.wfrp4e.value}`;
            msgContent = `
              <h2>${conditionName}</h2>
              <a class="condition-script" data-combatant-id="${turn.id}" data-cond-id="${cond.statusId}">${game.i18n.format("CONDITION.Apply", { condition: conditionName })}</a>
              `;
            ChatMessage.create({ content: msgContent, speaker: { alias: turn.token.name } });
          }
        }
        let conditions = turn.actor.actorEffects.filter((e) => e.isCondition);
        for (let cond of conditions) {
          if (cond.statusId == "deafened" || cond.statusId == "blinded" && Number.isNumeric(cond.flags.wfrp4e.roundReceived)) {
            if ((combat.round - 1) % 2 == cond.flags.wfrp4e.roundReceived % 2) {
              turn.actor.removeCondition(cond.statusId);
              removedConditions.push(
                game.i18n.format("CHAT.RemovedConditions", {
                  condition: game.i18n.localize(game.wfrp4e.config.conditions[cond.statusId]),
                  name: turn.actor.token?.name || turn.actor.prototypeToken.name
                })
              );
            }
          }
        }
        turn.actor.runEffects("endRound", combat, { async: true });
      }
      if (removedConditions.length)
        ChatMessage.create({ content: removedConditions.join("<br>") });
    }
    static checkEndTurnConditions(combat) {
      if (!game.user.isUniqueGM)
        return;
      let combatant = combat.turns[combat.turn];
      if (combatant) {
        let msgContent = "";
        let endTurnConditions = combatant.actor.actorEffects.filter((e) => e.conditionTrigger == "endTurn");
        for (let cond of endTurnConditions) {
          if (game.wfrp4e.config.conditionScripts[cond.statusId]) {
            let conditionName = game.i18n.localize(game.wfrp4e.config.conditions[cond.statusId]);
            if (Number.isNumeric(cond.flags.wfrp4e.value))
              conditionName += ` ${cond.flags.wfrp4e.value}`;
            msgContent = `
                <h2>${conditionName}</h2>
                <a class="condition-script" data-combatant-id="${combatant.id}" data-cond-id="${cond.statusId}">${game.i18n.format("CONDITION.Apply", { condition: conditionName })}</a>
                `;
            ChatMessage.create({ content: msgContent, speaker: { alias: combatant.token.name } });
          }
        }
        combatant.actor.runEffects("endTurn", combat);
      }
    }
    static fearReminders(combat) {
      let chatData = { content: game.i18n.localize("CHAT.FearReminder") + "<br><br>", speaker: { alias: game.i18n.localize("CHAT.Fear") } };
      let fearedCombatants = combat.turns.filter((t) => t.actor.hasCondition("fear"));
      if (!fearedCombatants.length)
        return;
      fearedCombatants.forEach((c) => {
        let fear = c.actor.hasCondition("fear");
        chatData.content += `<b>${c.name}</b>`;
        if (fear.flags.wfrp4e.fearName)
          chatData.content += ` (${fear.flags.wfrp4e.fearName})`;
        chatData.content += "<br>";
      });
      ChatMessage.create(chatData);
    }
    static async clearCombatantAdvantage(combat) {
      if (!game.user.isUniqueGM)
        return;
      if (game.settings.get("wfrp4e", "useGroupAdvantage")) {
        await WFRP_Utility.updateGroupAdvantage({ players: 0, enemies: 0 });
      }
      for (let turn of combat.turns) {
        turn.actor.update({ "system.status.advantage.value": 0 }, { skipGroupAdvantage: true });
        turn.actor.runEffects("endCombat", combat);
      }
    }
  };
  var CombatHelpers = _CombatHelpers;
  __publicField(CombatHelpers, "scripts", {
    startCombat: [_CombatHelpers.checkFearTerror],
    endCombat: [_CombatHelpers.clearCombatantAdvantage, _CombatHelpers.endCombatChecks],
    startTurn: [_CombatHelpers.startTurnChecks],
    endRound: [_CombatHelpers.checkEndRoundConditions, _CombatHelpers.fearReminders],
    endTurn: [_CombatHelpers.checkEndTurnConditions],
    endCombatScripts: [_CombatHelpers.checkCorruption, _CombatHelpers.checkInfection, _CombatHelpers.checkDiseases]
  });

  // modules/hooks/combat.js
  function combat_default() {
    Hooks.on("updateCombat", CombatHelpers.updateCombat);
    Hooks.on("preUpdateCombat", CombatHelpers.preUpdateCombat);
    Hooks.on("deleteCombat", CombatHelpers.endCombat);
    Hooks.on("preCreateCombatant", (combatant, data) => {
      let mask = canvas.tokens.get(data.tokenId).document.getFlag("wfrp4e", "mask");
      if (mask) {
        data.img = "systems/wfrp4e/tokens/unknown.png";
        data.name = "???";
        setProperty(data, "flags.wfrp4e.mask", mask);
      }
    });
    Hooks.on("createCombatant", (combatant) => {
      if (game.settings.get("wfrp4e", "useGroupAdvantage")) {
        let advantage = game.settings.get("wfrp4e", "groupAdvantageValues");
        combatant.actor.update({ "system.status.advantage.value": advantage[combatant.actor.advantageGroup] }, { fromGroupAdvantage: true });
      }
    });
    Hooks.on("renderCombatCarousel", () => {
      addClassByQuerySelector("wfrp4e", "#combat-carousel");
      let carouselSize = game.settings.get("combat-carousel", "carouselSize");
      if (carouselSize !== "") {
        addClassByQuerySelector(carouselSize, "#combat-carousel");
      }
    });
    function addClassByQuerySelector(className, selector) {
      let navigation = document.querySelector(selector);
      navigation.classList.add(className);
    }
    Hooks.on("renderCombatTracker", (app, html, options) => {
      if (game.settings.get("wfrp4e", "useGroupAdvantage")) {
        let advantage = game.settings.get("wfrp4e", "groupAdvantageValues");
        let element = $(`
      <div class="advantage-groups">
      <div class="advantage-group">
      <label>${game.i18n.localize("Players")}</label>
      <input data-group="players" type="number" value=${advantage.players}>
      </div>

      <div class="advantage-group">
      <label>${game.i18n.localize("Enemies")}</label>
      <input data-group="enemies" ${game.user.isGM ? "" : "disabled"} type="number" value=${advantage.enemies}>
      </div>
      </div>
      `);
        element.find("input").on("focus", (ev) => {
          ev.target.select();
        });
        element.find("input").on("change", async (ev) => {
          let group = ev.currentTarget.dataset.group;
          let value = Number(ev.currentTarget.value || 0);
          WFRP_Utility.updateGroupAdvantage({ [`${group}`]: value });
        });
        element.insertAfter(html.find(".combat-tracker-header"));
      }
    });
  }

  // modules/hooks/getSceneControlButtons.js
  function getSceneControlButtons_default() {
    Hooks.on("getSceneControlButtons", (buttons) => {
      if (!game.canvas || !game.canvas.scene)
        return;
      let group = buttons.find((b) => b.name == "lighting");
      group.tools.push({
        button: true,
        icon: "fas fa-circle",
        name: "morrslieb",
        title: game.canvas.scene.getFlag("wfrp4e", "morrslieb") ? "Morrslieb - Currently On " : "Morrslieb - Currently Off",
        onClick: WFRP_Utility.toggleMorrslieb
      });
    });
  }

  // modules/hooks/hotbarDrop.js
  function hotbarDrop_default() {
    Hooks.on("hotbarDrop", (bar, data, slot) => {
      if (data.type == "Item" || data.type == "Actor") {
        handleMacroCreation(bar, data, slot);
        return false;
      }
      ;
    });
  }
  async function handleMacroCreation(bar, data, slot) {
    let document2 = await fromUuid(data.uuid);
    if (!document2)
      return;
    let macro;
    if (document2.documentName == "Item") {
      if (document2.type != "weapon" && document2.type != "spell" && document2.type != "prayer" && document2.type != "trait" && document2.type != "skill")
        return;
      if (!document2)
        return false;
      let command = `game.wfrp4e.utility.rollItemMacro("${document2.name}", "${document2.type}");`;
      macro = game.macros.contents.find((m) => m.name === document2.name && m.command === command);
      if (!macro) {
        macro = await Macro.create({
          name: document2.name,
          type: "script",
          img: document2.img,
          command
        }, { displaySheet: false });
      }
    } else if (document2.documentName == "Actor") {
      let command = `Hotbar.toggleDocumentSheet("${document2.uuid}")`;
      macro = game.macros.contents.find((m) => m.name === document2.name && m.command === command);
      if (!macro) {
        macro = await Macro.create({
          name: "Display " + document2.name,
          type: "script",
          img: document2.prototypeToken.texture.src,
          command
        }, { displaySheet: false });
      }
    }
    game.user.assignHotbarMacro(macro, slot);
  }

  // modules/hooks/item.js
  function item_default() {
    Hooks.on("updateItem", (item, update, options) => {
      if (item.type == "container" && update.data?.location?.value) {
        let allContainers = item.actor.getItemTypes("container");
        if (formsLoop(item, allContainers)) {
          ui.notifications.error("Loop formed - Resetting Container Location");
          return item.update({ "system.location.value": "" });
        }
      }
      function formsLoop(container, containerList, stack = []) {
        if (!container.location.value)
          return false;
        else if (stack.includes(container.id))
          return true;
        else {
          stack.push(container.id);
          return formsLoop(containerList.find((c) => c.id == container.location.value), containerList, stack);
        }
      }
    });
    Hooks.on("createItem", (item, actor) => {
      if (!item.isOwned)
        return;
      if (item.actor.type == "vehicle")
        return;
      try {
        if (item.type == "critical") {
          let newWounds;
          if (item.wounds.value.toLowerCase() == "death")
            newWounds = 0;
          newWounds = item.actor.status.wounds.value - Number(item.wounds.value);
          if (newWounds < 0)
            newWounds = 0;
          item.actor.update({ "system.status.wounds.value": newWounds });
          ui.notifications.notify(`${item.wounds.value} ${game.i18n.localize("CHAT.CriticalWoundsApplied")} ${item.actor.name}`);
          if (game.combat && game.user.isGM) {
            let minorInfections = game.combat.getFlag("wfrp4e", "minorInfections") || [];
            minorInfections.push(item.actor.name);
            game.combat.setFlag("wfrp4e", "minorInfections", null).then((c) => game.combat.setFlag("wfrp4e", "minorInfections", minorInfections));
          }
        }
      } catch (error2) {
        console.error(game.i18n.localize("ErrorCriticalWound") + ": " + error2);
      }
      if (item.type == "career" && item.actor.type == "creature") {
        item.actor._advanceNPC(item);
      }
    });
    Hooks.on("deleteItem", (item) => {
      if (item.type == "container" && item.isOwned) {
        let updates = item.item.actor.items.filter((i) => i.location?.value == item.id).map((i) => i.toObject()).map((i) => {
          return {
            _id: i._id,
            "system.location.value": ""
          };
        });
        item.item.actor.updateEmbeddedDocuments("Item", updates);
      }
    });
  }

  // modules/hooks/activeEffects.js
  function activeEffects_default() {
    Hooks.on("preCreateActiveEffect", (effect, options, id) => {
      if (getProperty(effect, "flags.wfrp4e.preventDuplicateEffects")) {
        if (effect.parent?.documentName == "Actor" && effect.parent.effects.find((e) => e.label == effect.label)) {
          ui.notifications.notify(`${game.i18n.format("EFFECT.Prevent", { name: effect.label })}`);
          return false;
        }
      }
    });
  }

  // modules/hooks/journal.js
  function journal_default() {
    Hooks.on("getJournalSheetHeaderButtons", (sheet, buttons) => {
      if (sheet.document.sceneNote)
        buttons.unshift(
          {
            class: "pin",
            icon: "fas fa-map-pin",
            onclick: async (ev) => sheet.document.panToNote()
          }
        );
    });
    Hooks.on("renderJournalPageSheet", (obj, html, data) => {
      $(html).find(".close").attr("title", game.i18n.localize("Close"));
      $(html).find(".entry-image").attr("title", game.i18n.localize("JOURNAL.ModeImage"));
      $(html).find(".entry-text").attr("title", game.i18n.localize("JOURNAL.ModeText"));
      $(html).find(".share-image").attr("title", game.i18n.localize("JOURNAL.ActionShow"));
      html.find(".chat-roll").click(WFRP_Utility.handleRollClick.bind(WFRP_Utility));
      html.find(".symptom-tag").click(WFRP_Utility.handleSymptomClick.bind(WFRP_Utility));
      html.find(".condition-chat").click(WFRP_Utility.handleConditionClick.bind(WFRP_Utility));
      html.find(".table-click").mousedown(WFRP_Utility.handleTableClick.bind(WFRP_Utility));
      html.find(".pay-link").mousedown(WFRP_Utility.handlePayClick.bind(WFRP_Utility));
      html.find(".credit-link").mousedown(WFRP_Utility.handleCreditClick.bind(WFRP_Utility));
      html.find(".corruption-link").mousedown(WFRP_Utility.handleCorruptionClick.bind(WFRP_Utility));
      html.find(".fear-link").mousedown(WFRP_Utility.handleFearClick.bind(WFRP_Utility));
      html.find(".terror-link").mousedown(WFRP_Utility.handleTerrorClick.bind(WFRP_Utility));
      html.find(".exp-link").mousedown(WFRP_Utility.handleExpClick.bind(WFRP_Utility));
    });
  }

  // modules/apps/bug-report.js
  var BugReportFormWfrp4e = class extends Application {
    constructor(app) {
      super(app);
      this.endpoint = "https://aa5qja71ih.execute-api.us-east-2.amazonaws.com/Prod/grievance";
      this.github = "https://api.github.com/repos/moo-man/WFRP4e-FoundryVTT/";
      this.domains = [
        "WFRP4e System",
        "WFRP4e Core",
        "Starter Set",
        "Rough Nights & Hard Days",
        "Enemy In Shadows",
        "Ubersreik Adventures I",
        "Death on the Reik",
        "Middenheim: City of the White Wolf",
        "Archives of the Empire: Vol 1.",
        "Power Behind the Throne",
        "Altdorf: Crown of the Empire",
        "Ubersreik Adventures II",
        "Old World Bundle I",
        "The Horned Rat",
        "Empire in Ruins"
      ];
      this.domainKeys = [
        "wfrp4e",
        "wfrp4e-core",
        "wfrp4e-starter-set",
        "wfrp4e-rnhd",
        "wfrp4e-eis",
        "wfrp4e-ua1",
        "wfrp4e-dotr",
        "wfrp4e-middenheim",
        "wfrp4e-archives1",
        "wfrp4e-pbtt",
        "wfrp4e-altdorf",
        "wfrp4e-ua2",
        "wfrp4e-owb1",
        "wfrp4e-horned-rat",
        "wfrp4e-empire-ruins"
      ];
      this.domainKeysToLabel = {
        "wfrp4e": "system",
        "wfrp4e-core": "core",
        "wfrp4e-starter-set": "starter-set",
        "wfrp4e-rnhd": "rnhd",
        "wfrp4e-eis": "eis",
        "wfrp4e-ua1": "ua1",
        "wfrp4e-dotr": "dotr",
        "wfrp4e-middenheim": "middenheim",
        "wfrp4e-archives1": "archives",
        "wfrp4e-pbtt": "pbtt",
        "wfrp4e-altdorf": "altdorf",
        "wfrp4e-ua2": "ua2",
        "wfrp4e-owb1": "owb1",
        "wfrp4e-horned-rat": "horned-rat",
        "wfrp4e-empire-ruins": "empire-ruins"
      };
      this.issues = this.loadIssues();
      this.latest = this.checkVersions();
    }
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "bug-report";
      options.template = "systems/wfrp4e/templates/apps/bug-report.html";
      options.classes.push("wfrp4e", "wfrp-bug-report");
      options.resizable = true;
      options.width = 600;
      options.minimizable = true;
      options.title = "Enter Your Grudge";
      return options;
    }
    async _render(...args) {
      await super._render(...args);
      this.issues = await this.issues;
      this.latest = await this.latest;
      this.element.find(".module-check").replaceWith(this.formatVersionWarnings());
    }
    async getData() {
      let data = await super.getData();
      data.domains = this.domains;
      data.name = game.settings.get("wfrp4e", "bugReportName");
      return data;
    }
    formatVersionWarnings() {
      if (!this.latest || this.latest instanceof Promise) {
        return "<div></div>";
      }
      let domainMap = {};
      this.domainKeys.forEach((key, i) => {
        domainMap[key] = this.domains[i];
      });
      let allUpdated = true;
      let outdatedList = "";
      for (let key in this.latest) {
        if (!this.latest[key]) {
          allUpdated = false;
          outdatedList += `<li>${domainMap[key]}</li>`;
        }
      }
      let element = `<div class='notification ${allUpdated ? "stable" : "warning"}'>`;
      if (allUpdated) {
        element += `<p>All WFRP4e packages up to date!</p>`;
      } else {
        element += `<p>The Following WFRP4e packages are not up to date`;
        element += "<ul>";
        element += outdatedList;
        element += "</ul>";
      }
      element += "</div>";
      return element;
    }
    submit(data) {
      fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: data.title,
          body: data.description,
          assignees: ["moo-man"],
          labels: data.labels
        })
      }).then((res) => {
        if (res.status == 201) {
          ui.notifications.notify(game.i18n.localize("GrudgePost"));
          res.json().then((json) => {
            console.log("%c%s%c%s", "color: lightblue", `DAMMAZ KRON:`, "color: unset", ` The longbeards hear you, thank you for your submission into the Dammaz Kron, these wrongs must be righted! If you wish to monitor or follow up with additional details like screenshots, you can find your issue here: ${json.html_url}.`);
          });
        } else {
          ui.notifications.error(game.i18n.localize("GrudgePostError"));
          console.error(res);
        }
      }).catch((err) => {
        ui.notifications.error(game.i18n.localize("Something went wrong"));
        console.error(err);
      });
    }
    async loadIssues() {
      WFRP_Utility.log("Loading GitHub Issues...");
      let issues = await fetch(this.github + "issues").then((r) => r.json()).catch((error2) => console.error(error2));
      WFRP_Utility.log("Issues: ", void 0, issues);
      return issues;
    }
    async checkVersions() {
      let latest = {};
      WFRP_Utility.log("Checking Version Numbers...");
      for (let key of this.domainKeys) {
        if (key == game.system.id) {
          let release = await fetch(this.github + "releases/latest").then((r) => r.json()).catch((e) => console.error(e));
          latest[key] = !isNewerVersion(release.tag_name, game.system.version);
        } else if (game.modules.get(key)) {
          let manifest = await fetch(`https://foundry-c7-manifests.s3.us-east-2.amazonaws.com/${key}/module.json`).then((r) => r.json()).catch((e) => console.error(e));
          latest[key] = !isNewerVersion(manifest.version, game.modules.get(key).version);
        }
        WFRP_Utility.log(key + ": " + latest[key]);
      }
      WFRP_Utility.log("Version Status:", void 0, latest);
      return latest;
    }
    matchIssues(text) {
      if (this.issues instanceof Promise || !this.issues?.length)
        return [];
      let words = text.toLowerCase().split(" ");
      let percentages = new Array(this.issues.length).fill(0);
      this.issues.forEach((issue, issueIndex) => {
        let issueWords = (issue.title + " " + issue.body).toLowerCase().trim().split(" ");
        words.forEach((word) => {
          {
            if (issueWords.includes(word))
              percentages[issueIndex]++;
          }
        });
      });
      let matchingIssues = [];
      percentages = percentages.map((i) => i / this.issues.length);
      percentages.forEach((p, i) => {
        if (p > 0)
          matchingIssues.push(this.issues[i]);
      });
      return matchingIssues;
    }
    showMatchingGrudges(element, issues) {
      if (!issues || issues?.length <= 0)
        element[0].style.display = "none";
      else {
        element[0].style.display = "flex";
        let list = element.find(".grudge-list");
        list.children().remove();
        list.append(issues.map((i) => `<div class="grudge"><a href="${i.html_url}">${i.title}</div>`));
      }
    }
    activateListeners(html) {
      let publicityWarning = html.find(".publicity")[0];
      let modulesWarning = html.find(".active-modules")[0];
      let title = html.find(".bug-title")[0];
      let description = html.find(".bug-description")[0];
      let matching = html.find(".matching");
      html.find(".issuer").keyup((ev) => {
        publicityWarning.style.display = ev.currentTarget.value.includes("@") ? "block" : "none";
      });
      html.find(".issue-label").change((ev) => {
        if (ev.currentTarget.value == "bug") {
          if (game.modules.contents.filter((i) => i.active).map((i) => i.id).filter((i) => !this.domainKeys.includes(i)).length > 0)
            modulesWarning.style.display = "block";
          else
            modulesWarning.style.display = "none";
        } else
          modulesWarning.style.display = "none";
      });
      html.find(".bug-title, .bug-description").keyup(async (ev) => {
        let text = title.value + " " + description.value;
        text = text.trim();
        if (text.length > 2) {
          this.showMatchingGrudges(matching, this.matchIssues(text));
        }
      });
      html.find(".bug-submit").click((ev) => {
        let data = {};
        let form = $(ev.currentTarget).parents(".bug-report")[0];
        data.domain = $(form).find(".domain")[0].value;
        data.title = $(form).find(".bug-title")[0].value;
        data.description = $(form).find(".bug-description")[0].value;
        data.issuer = $(form).find(".issuer")[0].value;
        let label = $(form).find(".issue-label")[0].value;
        if (!data.domain || !data.title || !data.description)
          return ui.notifications.error(game.i18n.localize("BugReport.ErrorForm"));
        if (!data.issuer)
          return ui.notifications.error(game.i18n.localize("BugReport.ErrorName1"));
        if (!data.issuer.includes("@") && !data.issuer.includes("#"))
          return ui.notifications.notify(game.i18n.localize("BugReport.ErrorName2"));
        data.title = `[${this.domains[Number(data.domain)]}] ${data.title}`;
        data.description = data.description + `<br/>**From**: ${data.issuer}`;
        data.labels = [this.domainKeysToLabel[this.domainKeys[Number(data.domain)]]];
        if (label)
          data.labels.push(label);
        game.settings.set("wfrp4e", "bugReportName", data.issuer);
        let wfrp4eModules = Array.from(game.modules).filter((m) => this.domainKeys.includes(m.id));
        let versions = `<br/>foundry: ${game.version}<br/>wfrp4e: ${game.system.version}`;
        for (let mod of wfrp4eModules) {
          let modData = game.modules.get(mod.id);
          if (modData.active)
            versions = versions.concat(`<br/>${mod.id}: ${modData.version}`);
        }
        data.description = data.description.concat(versions);
        data.description += `<br/>Active Modules: ${game.modules.contents.filter((i) => i.active).map((i) => i.id).filter((i) => !this.domainKeys.includes(i)).join(", ")}`;
        this.submit(data);
        this.close();
      });
    }
  };

  // modules/hooks/sidebar.js
  function sidebar_default() {
    Hooks.on("renderSidebarTab", async (app, html) => {
      if (app.options.id == "chat" && app.options.popOut) {
        html[0].style.width = "390px";
      }
      if (app.options.id == "settings") {
        let button = $(`<button class='bug-report'>${game.i18n.localize("BUTTON.PostBug")}</button>`);
        button.click((ev) => {
          new BugReportFormWfrp4e().render(true);
        });
        button.insertAfter(html.find("#game-details"));
      }
      if (app.options.id == "tables") {
        html.on("click", ".rolltable img", (ev) => {
          let table = game.tables.get($(ev.currentTarget).parent().attr("data-document-id"));
          let key = table.getFlag("wfrp4e", "key");
          let column = table.getFlag("wfrp4e", "column");
          if (!key)
            return;
          game.wfrp4e.tables.formatChatRoll(key, {}, column).then((text) => {
            let chatOptions = game.wfrp4e.utility.chatDataSetup(text, game.settings.get("core", "rollMode"), true);
            chatOptions.speaker = { alias: table.name };
            ChatMessage.create(chatOptions);
            ui.sidebar.activateTab("chat");
          });
        });
      }
      if (app.options.id == "actors") {
        let button = $(`<button class='character-creation'>${game.i18n.localize("BUTTON.CharacterCreation")}</button>`);
        button.click((ev) => {
          new Dialog({
            title: game.i18n.localize("BUTTON.CharacterCreation"),
            content: `<p>${game.i18n.localize("DIALOG.BeginCharacterCreation")}</p>`,
            buttons: {
              yes: {
                label: game.i18n.localize("Yes"),
                callback: (dlg) => {
                  ui.sidebar.activateTab("chat");
                  CONFIG.Actor.documentClass.create({ type: "character", name: "New Character" }, { renderSheet: true });
                  GeneratorWfrp4e.start();
                  game.wfrp4e.generator.speciesStage();
                }
              },
              no: {
                label: game.i18n.localize("No")
              }
            }
          }).render(true);
        });
        button.insertAfter(html.find(".header-actions"));
      }
    });
  }

  // modules/hooks/rolltable.js
  function rolltable_default() {
    Hooks.on("preCreateTableResult", (result, data) => {
      if (!data.img)
        result.updateSource({ "img": "icons/svg/d10-grey.svg" });
    });
    Hooks.on("preCreateRollTable", (table, data) => {
      if (!data.img)
        table.updateSource({ "img": "systems/wfrp4e/ui/buttons/d10.webp" });
    });
  }

  // modules/apps/stat-parser.js
  var StatBlockParser = class extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "stat-parser";
      options.template = "systems/wfrp4e/templates/apps/stat-parser.html";
      options.height = 600;
      options.width = 600;
      options.minimizable = true;
      options.title = "Stat Block Parser";
      return options;
    }
    getData() {
      let types = game.system.template.Actor.types;
      return { types };
    }
    async _updateObject(event2, formData) {
      let { name, type, data, items } = await StatBlockParser.parseStatBlock(formData.statBlock, this.object.type);
      await this.object.update({ name, type, data });
      await this.object.createEmbeddedDocuments("Item", items);
    }
    static async parseStatBlock(statString, type = "npc") {
      let model = duplicate(game.system.model.Actor[type]);
      let blockArray = statString.split("\n");
      let name = blockArray[0].split("\u2014")[0].split(" ").filter((f) => !!f);
      name = name.map((word) => {
        if (word == "VON")
          return word.toLowerCase();
        word = word.toLowerCase();
        word = word[0].toUpperCase() + word.substring(1, word.length);
        return word;
      });
      name = name.join(" ");
      let status = -1;
      if (blockArray[0].includes("("))
        status = blockArray[0];
      else if (blockArray[1].includes("("))
        status = blockArray[1];
      if (status != -1 && hasProperty(model, "details.status.value")) {
        status = status.substring(status.indexOf("(") + 1, status.indexOf(")"));
        model.details.status.value = status[0] + status.slice(1).toLowerCase();
      }
      let tableIndex = blockArray.findIndex((v) => v.includes(" WS "));
      let characteristicNames = blockArray[tableIndex].split(" ");
      let characteristicValues = blockArray[tableIndex + 1].split(" ");
      for (let i = 0; i < characteristicNames.length; i++) {
        if (characteristicNames[i] == "Agi")
          characteristicNames[i] = "Ag";
        if (characteristicNames[i].toLowerCase() == "m") {
          model.details.move.value = Number(characteristicValues[i]);
          continue;
        }
        if (characteristicNames[i].toLowerCase() == "w")
          continue;
        try {
          model.characteristics[characteristicNames[i].toLowerCase()].initial = Number(characteristicValues[i]);
        } catch {
        }
      }
      let skillRegex = /([a-zA-Z\s]+?)(?:\((.+?)\)|)\s?(\d{1,3}|)(?:,|$)/gm;
      let talentRegex = /(?:,?(.+?)(\d{1,2})?(?:\((.+?)\)\s*(\d{1,2})?|,|$))/gm;
      let traitRegex = /(?:,?(.+?)(\+?\d{1,2}\+?)?\s*?(?:\((.+?)\)\s*(\+?\d{1,2})?|,|$))/gm;
      let skillBlockIndexStart = blockArray.findIndex((v) => v.split(" ")[0].includes(game.i18n.localize("Skills")));
      let talentBlockIndexStart = blockArray.findIndex((v) => v.split(" ")[0].includes(game.i18n.localize("Talents")));
      let traitBlockIndexStart = blockArray.findIndex((v) => v.split(" ")[0].includes(game.i18n.localize("Traits")));
      let trappingBlockIndexStart = blockArray.findIndex((v) => v.split(" ")[0].includes(game.i18n.localize("Trappings")) || v.split(" ")[0].includes(game.i18n.localize("Possessions")));
      let skillBlockIndex = skillBlockIndexStart;
      let talentBlockIndex = talentBlockIndexStart;
      let traitBlockIndex = traitBlockIndexStart;
      let trappingBlockIndex = trappingBlockIndexStart;
      let skillBlock = blockArray[skillBlockIndex] || "";
      let talentBlock = blockArray[talentBlockIndex] || "";
      let traitBlock = blockArray[traitBlockIndex] || "";
      let trappingBlock = blockArray[trappingBlockIndex] || "";
      while (skillBlockIndex >= 0) {
        skillBlockIndex++;
        if (skillBlockIndex == talentBlockIndexStart || skillBlockIndex == traitBlockIndexStart || skillBlockIndex == trappingBlockIndexStart || skillBlockIndex >= blockArray.length)
          break;
        skillBlock = skillBlock.concat(" " + blockArray[skillBlockIndex]);
      }
      while (talentBlockIndex >= 0) {
        talentBlockIndex++;
        if (talentBlockIndex == skillBlockIndexStart || talentBlockIndex == traitBlockIndexStart || talentBlockIndex == trappingBlockIndexStart || talentBlockIndex >= blockArray.length)
          break;
        talentBlock = talentBlock.concat(" " + blockArray[talentBlockIndex]);
      }
      while (traitBlockIndex >= 0) {
        traitBlockIndex++;
        if (traitBlockIndex == skillBlockIndexStart || traitBlockIndex == talentBlockIndexStart || traitBlockIndex == trappingBlockIndexStart || traitBlockIndex >= blockArray.length)
          break;
        traitBlock = traitBlock.concat(" " + blockArray[traitBlockIndex]);
      }
      while (trappingBlockIndex >= 0) {
        trappingBlockIndex++;
        if (trappingBlockIndex == skillBlockIndexStart || trappingBlockIndex == talentBlockIndexStart || trappingBlockIndex == traitBlockIndexStart || trappingBlockIndex >= blockArray.length)
          break;
        trappingBlock = trappingBlock.concat(" " + blockArray[trappingBlockIndex]);
      }
      let skillStrings = skillBlock.substring(skillBlock.indexOf(":") + 1);
      let talentStrings = talentBlock.substring(talentBlock.indexOf(":") + 1);
      let traitStrings = traitBlock.substring(traitBlock.indexOf(":") + 1);
      let trappingStrings = trappingBlock.substring(trappingBlock.indexOf(":") + 1);
      let skillMatches = skillStrings.matchAll(skillRegex);
      let talentMatches = talentStrings.matchAll(talentRegex);
      let traitMatches = traitStrings.matchAll(traitRegex);
      let skills = [];
      let talents = [];
      let traits = [];
      let trappings = [];
      for (let match of skillMatches) {
        let skillName = match[1];
        let skillGroup = match[2];
        let skillValue = match[3];
        let skillSearches = [];
        let skillItems = [];
        if (!Number.isNumeric(skillValue)) {
          let innerMatches = skillGroup.matchAll(skillRegex);
          for (let inner of innerMatches) {
            skillSearches.push({ name: skillName, group: inner[1], value: inner[3] });
          }
        } else {
          skillSearches.push({ name: skillName, group: skillGroup, value: skillValue });
        }
        skillSearches.forEach((s) => {
          s.name = s.name?.trim();
          s.group = s.group?.trim();
          s.value = s.value?.trim();
        });
        for (let search of skillSearches) {
          let skillItem;
          try {
            skillItem = await WFRP_Utility.findSkill(`${search.name} ${search.group ? "(" + search.group + ")" : ""}`.trim());
          } catch {
          }
          if (!skillItem) {
            console.error("Could not find " + search.name);
            ui.notifications.error(game.i18n.format("ERROR.Parser", { name: search.name }), { permanent: true });
            continue;
          } else
            skillItem = skillItem.toObject();
          skillItem.system.advances.value = Number(search.value) - model.characteristics[skillItem.system.characteristic.value].initial;
          skillItems.push(skillItem);
        }
        skills = skills.concat(skillItems);
      }
      for (let match of talentMatches) {
        let talentName = match[1].trim();
        let talentAdvances = parseInt(match[2] || match[4]);
        let talentSpec = match[3]?.trim();
        let talentItem;
        try {
          talentItem = await WFRP_Utility.findTalent(talentName);
        } catch {
        }
        if (!talentItem) {
          console.error("Could not find " + talentName);
          ui.notifications.error(game.i18n.format("ERROR.Parser", { name: talentName }), { permanent: true });
          continue;
        }
        talentItem = talentItem.toObject();
        if (talentName == game.i18n.localize("NAME.Doomed")) {
          talentItem.system.description.value += `<br><br><em>${talentSpec}</em>`;
        } else if (talentName == game.i18n.localize("NAME.Etiquette")) {
          talentItem.system.tests.value = talentItem.system.tests.value.replace(game.i18n.localize("Social Group"), match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentName == game.i18n.localize("NAME.Resistance")) {
          talentItem.system.tests.value = talentItem.system.tests.value.replace(game.i18n.localize("the associated Threat"), match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentName == game.i18n.localize("NAME.AcuteSense")) {
          talentItem.system.tests.value = talentItem.system.tests.value.replace(game.i18n.localize("Sense"), match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentName == game.i18n.localize("NAME.Strider")) {
          talentItem.system.tests.value = talentItem.system.tests.value.replace(game.i18n.localize("the Terrain"), match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentName == game.i18n.localize("NAME.Savant")) {
          talentItem.system.tests.value = talentItem.system.tests.value.replace(game.i18n.localize("chosen Lore"), match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentName == "Craftsman") {
          talentItem.system.tests.value = talentItem.system.tests.value.replace("any one", match[3]);
          talentItem.name += ` (${talentSpec})`;
        } else if (talentSpec)
          talentItem.name += ` (${talentSpec})`;
        talentItem.system.advances.value = 1;
        if (Number.isNumeric(talentAdvances)) {
          for (let i = 1; i < talentAdvances; i++)
            talents.push(talentItem);
        }
        talents.push(talentItem);
      }
      for (let match of traitMatches) {
        let traitName = match[1];
        let traitVal = match[2] || match[4];
        let traitSpec = match[3];
        let traitItem;
        try {
          traitItem = await WFRP_Utility.findItem(traitName, "trait");
        } catch {
        }
        if (!traitItem) {
          console.error("Could not find " + traitName);
          ui.notifications.error(game.i18n.format("ERROR.Parser", { name: traitName }), { permanent: true });
          continue;
        }
        traitItem = traitItem.toObject();
        if (Number.isNumeric(traitVal)) {
          traitItem.system.specification.value = traitVal;
          traitItem.name = (traitItem.name + ` ${traitSpec ? "(" + traitSpec + ")" : ""}`).trim();
        } else
          traitItem.system.specification.value = traitSpec;
        traits.push(traitItem);
      }
      if (trappingStrings) {
        for (let trapping of trappingStrings.split(",")) {
          let trappingItem = await WFRP_Utility.findItem(trapping);
          if (!trappingItem) {
            trappingItem = new ItemWfrp4e({ img: "systems/wfrp4e/icons/blank.png", name: trapping, type: "trapping", data: game.system.model.Item.trapping });
            trappingItem.updateSource({ "trappingType.value": "misc" });
          }
          trappings.push(trappingItem.toObject());
        }
      }
      let moneyItems = await WFRP_Utility.allMoneyItems() || [];
      moneyItems = moneyItems.sort((a, b) => a.system.coinValue > b.system.coinValue ? -1 : 1);
      moneyItems.forEach((m) => m.system.quantity.value = 0);
      skills.forEach((t) => {
        delete t._id;
      });
      trappings.forEach((t) => {
        delete t._id;
      });
      talents.forEach((t) => {
        delete t._id;
      });
      traits.forEach((t) => {
        delete t._id;
      });
      let effects = trappings.reduce((total, trapping) => total.concat(trapping.effects), []).concat(talents.reduce((total, talent) => total.concat(talent.effects), [])).concat(traits.reduce((total, trait) => total.concat(trait.effects), []));
      effects = effects.filter((e) => !!e);
      effects = effects.filter((e) => e.transfer);
      effects.forEach((e) => {
        let charChanges = e.changes.filter((c) => c.key.includes("characteristics"));
        for (let change of charChanges) {
          let split = change.key.split(".");
          let target = split.slice(1).join(".");
          setProperty(model, target, getProperty(model, target) + -1 * change.value);
        }
      });
      return { name, type, data: model, items: skills.concat(talents).concat(traits).concat(trappings).concat(moneyItems), effects };
    }
  };

  // modules/hooks/entryContext.js
  function entryContext_default() {
    Hooks.on("getActorDirectoryEntryContext", async (html, options) => {
      options.push(
        {
          name: game.i18n.localize("ACTOR.AddBasicSkills"),
          condition: game.user.isGM,
          icon: '<i class="fas fa-plus"></i>',
          callback: (target) => {
            const actor = game.actors.get(target.attr("data-document-id"));
            actor.addBasicSkills();
          }
        }
      );
      options.push(
        {
          name: game.i18n.localize("ACTOR.ClearMount"),
          icon: '<i class="fas fa-horse"></i>',
          callback: (target) => {
            const actor = game.actors.get(target.attr("data-document-id"));
            return actor.update({
              "system.status.mount": {
                "id": "",
                "mounted": false,
                "isToken": false,
                "tokenData": {
                  "scene": "",
                  "token": ""
                }
              }
            });
          }
        }
      );
      options.push(
        {
          name: game.i18n.localize("ACTOR.ImportStatBlock"),
          condition: game.user.isGM,
          icon: '<i class="fa fa-download"></i>',
          callback: (target) => {
            const actor = game.actors.get(target.attr("data-document-id"));
            new StatBlockParser(actor).render(true);
          }
        }
      );
    });
    Hooks.on("getChatLogEntryContext", (html, options) => {
      let canApply = (li) => game.messages.get(li.attr("data-message-id")).getOpposedTest() || li.find(".dice-roll").length > 0;
      let canApplyFortuneReroll = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return test && test.actor.isOwner && test.actor.status.fortune?.value > 0 && test.result.outcome == "failure" && !test.fortuneUsed.reroll;
      };
      let canApplyFortuneAddSL = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return test && test.actor.isOwner && test.actor.status.fortune?.value > 0 && !test.fortuneUsed.SL;
      };
      let canApplyDarkDeals = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return test && test.actor.isOwner && test.actor.type == "character";
      };
      let canGMReroll = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return test && game.user.isGM;
      };
      let canTarget = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return test && test.actor.isOwner;
      };
      let canCompleteUnopposed = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return game.user.isGM && test && test.opposedMessages.length >= 2;
      };
      let canApplyAllDamage = function(li) {
        let message2 = game.messages.get(li.attr("data-message-id"));
        let test = message2.getTest();
        return game.user.isGM && test && test.opposedMessages.length >= 2 && test.opposedMessages.every((m) => m.getOppose().resultMessage);
      };
      options.push(
        {
          name: game.i18n.localize("CHATOPT.ApplyDamage"),
          icon: '<i class="fas fa-user-minus"></i>',
          condition: canApply,
          callback: (li) => {
            if (li.find(".dice-roll").length) {
              let amount = li.find(".dice-total").text();
              game.user.targets.forEach((t) => t.actor.applyBasicDamage(amount));
            } else {
              let message2 = game.messages.get(li.attr("data-message-id"));
              let opposedTest = message2.getOpposedTest();
              if (!opposedTest.defenderTest.actor.isOwner)
                return ui.notifications.error(game.i18n.localize("ErrorDamagePermission"));
              let updateMsg = opposedTest.defenderTest.actor.applyDamage(opposedTest, game.wfrp4e.config.DAMAGE_TYPE.NORMAL);
              OpposedWFRP.updateOpposedMessage(updateMsg, message2.id);
            }
          }
        },
        {
          name: game.i18n.localize("CHATOPT.ApplyDamageNoAP"),
          icon: '<i class="fas fa-user-shield"></i>',
          condition: canApply,
          callback: (li) => {
            if (li.find(".dice-roll").length) {
              let amount = li.find(".dice-total").text();
              game.user.targets.forEach((t) => t.actor.applyBasicDamage(amount, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_AP }));
            } else {
              let message2 = game.messages.get(li.attr("data-message-id"));
              let opposedTest = message2.getOpposedTest();
              if (!opposedTest.defenderTest.actor.isOwner)
                return ui.notifications.error(game.i18n.localize("ErrorDamagePermission"));
              let updateMsg = opposedTest.defenderTest.actor.applyDamage(opposedTest, game.wfrp4e.config.DAMAGE_TYPE.IGNORE_AP);
              OpposedWFRP.updateOpposedMessage(updateMsg, message2.id);
            }
          }
        },
        {
          name: game.i18n.localize("CHATOPT.ApplyDamageNoTB"),
          icon: '<i class="fas fa-fist-raised"></i>',
          condition: canApply,
          callback: (li) => {
            if (li.find(".dice-roll").length) {
              let amount = li.find(".dice-total").text();
              game.user.targets.forEach((t) => t.actor.applyBasicDamage(amount, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_TB }));
            } else {
              let message2 = game.messages.get(li.attr("data-message-id"));
              let opposedTest = message2.getOpposedTest();
              if (!opposedTest.defenderTest.actor.isOwner)
                return ui.notifications.error(game.i18n.localize("ErrorDamagePermission"));
              let updateMsg = opposedTest.defenderTest.actor.applyDamage(opposedTest, game.wfrp4e.config.DAMAGE_TYPE.IGNORE_TB);
              OpposedWFRP.updateOpposedMessage(updateMsg, message2.id);
            }
          }
        },
        {
          name: game.i18n.localize("CHATOPT.ApplyDamageNoTBAP"),
          icon: '<i class="fas fa-skull-crossbones"></i>',
          condition: canApply,
          callback: (li) => {
            if (li.find(".dice-roll").length) {
              let amount = li.find(".dice-total").text();
              game.user.targets.forEach((t) => t.actor.applyBasicDamage(amount, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_ALL }));
            } else {
              let message2 = game.messages.get(li.attr("data-message-id"));
              let opposedTest = message2.getOpposedTest();
              if (!opposedTest.defenderTest.actor.isOwner)
                return ui.notifications.error(game.i18n.localize("ErrorDamagePermission"));
              let updateMsg = opposedTest.defenderTest.actor.applyDamage(opposedTest, game.wfrp4e.config.DAMAGE_TYPE.IGNORE_ALL);
              OpposedWFRP.updateOpposedMessage(updateMsg, message2.id);
            }
          }
        },
        {
          name: game.i18n.localize("CHATOPT.UseFortuneReroll"),
          icon: '<i class="fas fa-dice"></i>',
          condition: canApplyFortuneReroll,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.actor.useFortuneOnRoll(message2, "reroll");
          }
        },
        {
          name: game.i18n.localize("CHATOPT.Reroll"),
          icon: '<i class="fas fa-dice"></i>',
          condition: canGMReroll,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.reroll();
          }
        },
        {
          name: game.i18n.localize("CHATOPT.UseFortuneSL"),
          icon: '<i class="fas fa-plus-square"></i>',
          condition: canApplyFortuneAddSL,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.actor.useFortuneOnRoll(message2, "addSL");
          }
        },
        {
          name: game.i18n.localize("CHATOPT.DarkDeal"),
          icon: '<i class="fas fa-pen-nib"></i>',
          condition: canApplyDarkDeals,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.actor.useDarkDeal(message2);
          }
        },
        {
          name: game.i18n.localize("CHATOPT.OpposeTarget"),
          icon: '<i class="fas fa-crosshairs"></i>',
          condition: canTarget,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            let targets = Array.from(game.user.targets).map((t) => t.actor.speakerData(t.document));
            test.context.targets = test.context.targets.concat(targets);
            targets.map((t) => WFRP_Utility.getToken(t)).forEach((t) => {
              test.createOpposedMessage(t);
            });
          }
        },
        {
          name: game.i18n.localize("CHATOPT.CompleteUnopposed"),
          icon: '<i class="fas fa-angle-double-down"></i>',
          condition: canCompleteUnopposed,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.opposedMessages.forEach((message3) => {
              let oppose = message3.getOppose();
              oppose.resolveUnopposed();
            });
          }
        },
        {
          name: game.i18n.localize("CHATOPT.ApplyAllDamage"),
          icon: '<i class="fas fa-user-minus"></i>',
          condition: canApplyAllDamage,
          callback: (li) => {
            let message2 = game.messages.get(li.attr("data-message-id"));
            let test = message2.getTest();
            test.opposedMessages.forEach((message3) => {
              let opposedTest = message3.getOppose();
              if (!opposedTest.defenderTest.actor.isOwner)
                return ui.notifications.error(game.i18n.localize("ErrorDamagePermission"));
              let updateMsg = opposedTest.defender.applyDamage(opposedTest.resultMessage.getOpposedTest(), game.wfrp4e.config.DAMAGE_TYPE.NORMAL);
              OpposedWFRP.updateOpposedMessage(updateMsg, message3.id);
            });
          }
        }
      );
    });
  }

  // modules/hooks/token.js
  function token_default() {
    Hooks.on("renderTokenHUD", async (obj, html) => {
      for (let condition of html.find("img.effect-control")) {
        condition.title = game.wfrp4e.config.conditions[condition.dataset["statusId"]];
        if (condition.dataset["statusId"] == "dead")
          condition.title = "Dead";
      }
    });
    Hooks.on("createToken", async (token) => {
      setTimeout(() => {
        if (game.actors.get(token.actorId)?.type == "vehicle")
          passengerRender_default();
      }, 200);
      if (game.user.isUniqueGM) {
        let scene = token.parent;
        if (token.actor.isMounted && canvas.scene.id == scene.id) {
          let mount = token.actor.mount;
          let mountToken = await mount.getTokenDocument();
          mountToken.updateSource({ x: token.x, y: token.y, hidden: token.hidden });
          if (mountToken.actor.details.size.value == token.actor.details.size.value) {
            mountToken.updateSource({
              x: mountToken.x + canvas.grid.size / 4,
              y: mountToken.y + canvas.grid.size / 4
            });
          }
          mountToken = (await scene.createEmbeddedDocuments("Token", [mountToken]))[0];
          await token.update({ "flags.wfrp4e.mount": mountToken.id });
          token.zIndex = 1;
          if (!mountToken.actorLink) {
            let tokenData = {
              scene: scene._id,
              token: mountToken._id
            };
            token.actor.update({ "system.status.mount.isToken": true, "system.status.mount.tokenData": tokenData });
          }
        }
      }
    });
    Hooks.on("updateToken", (token, updateData, options) => {
      let scene = token.parent;
      if (game.user.isUniqueGM) {
        if (hasProperty(token, "flags.wfrp4e.mount") && (updateData.x || updateData.y) && scene.id == canvas.scene.id) {
          if (canvas.tokens.get(token.id).actor.isMounted) {
            let mountId = token.getFlag("wfrp4e", "mount");
            let tokenUpdate = { _id: mountId, x: token.x, y: token.y };
            if (token.actor.details.size.value == token.actor.mount.details.size.value) {
              tokenUpdate.x += canvas.grid.size / 4;
              tokenUpdate.y += canvas.grid.size / 4;
            }
            scene.updateEmbeddedDocuments("Token", [tokenUpdate]);
          }
        }
      }
      if (hasProperty(updateData, "flags.wfrp4e.mask") && token.actorLink == true) {
        game.actors.get(token.actorId).update({ "token.flags.wfrp4e.mask": getProperty(updateData, "flags.wfrp4e.mask") });
      }
    });
    Hooks.on("renderTokenHUD", (hud, html) => {
      if (canvas.tokens.controlled.length == 2) {
        const button = $(
          `<div class='control-icon'><i class="fas fa-horse"></i></div>`
        );
        button.attr(
          "title",
          "Mount"
        );
        button.mousedown((event2) => {
          let token1 = canvas.tokens.controlled[0].document;
          let token2 = canvas.tokens.controlled[1].document;
          if (!token1 || !token2)
            return;
          let mountee = hud.object.document;
          let mounter = hud.object.document.id == token1.id ? token2 : token1;
          if (game.wfrp4e.config.actorSizeNums[mounter.actor.details.size.value] > game.wfrp4e.config.actorSizeNums[mountee.actor.details.size.value]) {
            let temp = mountee;
            mountee = mounter;
            mounter = temp;
          }
          let tokenData = void 0;
          if (!mountee.actorLink) {
            tokenData = {
              scene: canvas.scene.id,
              token: mountee.id
            };
            if (mounter.actorLink)
              ui.notifications.warn(game.i18n.localize("WarnUnlinkedMount"));
          }
          mounter.actor.update({ "system.status.mount.id": mountee.actorId, "system.status.mount.mounted": true, "system.status.mount.isToken": !mountee.actorLink, "system.status.mount.tokenData": tokenData });
          canvas.scene.updateEmbeddedDocuments("Token", [{ "flags.wfrp4e.mount": mountee.id, _id: mounter.id }, { _id: mounter.id, x: mountee.x, y: mountee.y }]);
          mounter.zIndex = 1;
        });
        html.find(".col.right").append(button);
      }
    });
  }

  // modules/hooks/moduleHooks.js
  function moduleHooks_default() {
    Hooks.on("popout:renderSheet", (sheet) => {
      sheet.element.css({ width: "610px", height: "740px", padding: "0px" });
    });
  }

  // modules/hooks/setup.js
  function setup_default() {
    Hooks.on("setup", () => {
      for (let obj of game.wfrp4e.config.toTranslate) {
        for (let el in game.wfrp4e.config[obj]) {
          if (typeof game.wfrp4e.config[obj][el] === "string") {
            game.wfrp4e.config[obj][el] = game.i18n.localize(game.wfrp4e.config[obj][el]);
          }
        }
      }
    });
  }

  // modules/hooks/handlebars.js
  function handlebars_default() {
    Hooks.on("init", () => {
      Handlebars.registerHelper("ifIsGM", function(options) {
        return game.user.isGM ? options.fn(this) : options.inverse(this);
      });
      Handlebars.registerHelper("isGM", function(options) {
        return game.user.isGM;
      });
      Handlebars.registerHelper("config", function(key) {
        return game.wfrp4e.config[key];
      });
      Handlebars.registerHelper("configLookup", function(obj, key) {
        return game.wfrp4e.config[obj][key];
      });
      Handlebars.registerHelper("array", function(array, cls) {
        if (typeof cls == "string")
          return array.map((i) => `<a class="${cls}">${i}</a>`).join(`<h1 class="${cls} comma">, </h1>`);
        else
          return array.join(", ");
      });
      Handlebars.registerHelper("tokenImg", function(actor) {
        return actor.token ? actor.token.texture.src : actor.prototypeToken.texture.src;
      });
      Handlebars.registerHelper("tokenName", function(actor) {
        return actor.token ? actor.token.name : actor.prototypeToken.name;
      });
    });
  }

  // modules/hooks/keepId.js
  function keepId_default() {
    Hooks.on("preCreateScene", keepId);
    Hooks.on("preCreateJournalEntry", keepId);
    Hooks.on("preCreateRollTable", keepId);
    function keepId(document2, data, options) {
      if (data._id)
        options.keepId = WFRP_Utility._keepID(data._id, document2);
    }
  }

  // modules/hooks/settings.js
  function settings_default() {
    Hooks.on("updateSetting", (setting) => {
      if (setting.key == "wfrp4e.groupAdvantageValues") {
        ui.notifications.notify(game.i18n.format("GroupAdvantageUpdated", { players: setting.value.players, enemies: setting.value.enemies }));
        if (game.user.isGM && game.combat) {
          game.combat.combatants.forEach((c) => {
            if (c.actor.status.advantage.value != setting.value[c.actor.advantageGroup])
              c.actor.update({ "system.status.advantage.value": setting.value[c.actor.advantageGroup] }, { fromGroupAdvantage: true });
          });
        }
        [ui.combat].concat(Object.values(ui.windows).filter((w) => w instanceof CombatTracker)).forEach((tracker) => {
          tracker.element.find(".advantage-group input").each((index, input) => {
            let group = input.dataset.group;
            input.value = setting.value[group];
          });
        });
      }
    });
  }

  // modules/hooks/note.js
  function note_default() {
    Hooks.on("activateNote", (note, options) => {
      options.anchor = note.document.flags.anchor?.slug;
    });
  }

  // modules/system/hooks.js
  function registerHooks() {
    init_default();
    ready_default();
    canvas_default();
    chat_default();
    combat_default();
    getSceneControlButtons_default();
    hotbarDrop_default();
    actor_default();
    item_default();
    activeEffects_default();
    journal_default();
    sidebar_default();
    rolltable_default();
    entryContext_default();
    token_default();
    moduleHooks_default();
    setup_default();
    handlebars_default();
    settings_default();
    keepId_default();
    note_default();
  }

  // modules/apps/wfrp-browser.js
  var BrowserWfrp4e = class extends Application {
    constructor(app) {
      super(app);
      this.filters = {
        type: {
          "ammunition": { display: "Ammunition", value: false },
          "armour": { display: "Armour", value: false },
          "career": { display: "Career", value: false },
          "container": { display: "Container", value: false },
          "critical": { display: "Critical", value: false },
          "disease": { display: "Disease", value: false },
          "injury": { display: "Injury", value: false },
          "money": { display: "Money", value: false },
          "mutation": { display: "Mutation", value: false },
          "prayer": { display: "Prayer", value: false },
          "psychology": { display: "Psychology", value: false },
          "talent": { display: "Talent", value: false },
          "trapping": { display: "Trapping", value: false },
          "skill": { display: "Skill", value: false },
          "spell": { display: "Spell", value: false },
          "trait": { display: "Trait", value: false },
          "weapon": { display: "Weapon", value: false }
        },
        attribute: {
          name: "",
          description: "",
          worldItems: true
        },
        dynamic: {
          careergroup: { value: "", exactMatch: true, type: ["career"], show: false },
          class: { value: "", type: ["career"], show: false },
          level: { value: "", type: ["career"], show: false },
          statusTier: { value: "", type: ["career"], show: false },
          statusStanding: { value: "", relation: "", type: ["career"], show: false },
          characteristics: { value: [], type: ["career"], show: false },
          ammunitionType: { value: "", exactMatch: true, type: ["ammunition"], show: false },
          skills: { value: [], type: ["career"], show: false },
          talents: { value: [], type: ["career"], show: false },
          encumbrance: { value: "", relation: "", type: ["ammunition", "armour", "weapon", "container", "trapping"], show: false },
          availability: { value: "", type: ["ammunition", "armour", "weapon", "container", "trapping"], show: false },
          modifiesDamage: { value: false, type: ["ammunition"], show: false },
          modifiesRange: { value: false, type: ["ammunition"], show: false },
          qualitiesFlaws: { value: [], type: ["ammunition", "armour", "weapon"], show: false },
          armorType: { value: "", type: ["armour"], show: false },
          protects: { value: { head: true, body: true, arms: true, legs: true }, type: ["armour"], show: false },
          carries: { value: "", relation: "", type: ["container"], show: false },
          location: { value: "", type: ["critical", "injury"], show: false },
          wounds: { value: "", relation: "", type: ["critical"], show: false },
          symptoms: { value: [], type: ["disease"], show: false },
          mutationType: { value: "", type: ["mutation"], show: false },
          god: { value: "", type: ["prayer"], show: false },
          prayerType: { value: "", type: ["prayer"], show: false },
          range: { value: "", type: ["prayer", "spell"], show: false },
          duration: { value: "", type: ["prayer", "spell"], show: false },
          target: { value: "", type: ["prayer", "spell"], show: false },
          cn: { value: "", relation: "", type: ["spell"], show: false },
          magicMissile: { value: false, type: ["spell"], show: false },
          aoe: { value: false, type: ["spell"], show: false },
          lore: { value: "", type: ["spell"], show: false },
          extendable: { value: "", type: ["spell"], show: false },
          max: { value: "", type: ["talent"], show: false },
          tests: { value: "", type: ["talent"], show: false },
          trappingType: { value: "", type: ["trapping"], show: false },
          characteristic: { value: "", type: ["skill"], show: false },
          grouped: { value: "", type: ["skill"], show: false },
          advanced: { value: "", type: ["skill"], show: false },
          rollable: { value: false, type: ["trait"], show: false },
          weaponGroup: { value: "", type: ["weapon"], show: false },
          reach: { value: "", type: ["weapon"], show: false },
          weaponRange: { value: "", relation: "", type: ["weapon"], show: false },
          melee: { value: false, type: ["weapon"], show: false },
          ranged: { value: false, type: ["weapon"], show: false },
          twohanded: { value: false, type: ["weapon"], show: false },
          ammunitionGroup: { value: "", type: ["weapon"], show: false }
        }
      };
      this.careerGroups = [];
      this.careerClasses = [];
      this.gods = [];
      this.careerTiers = [1, 2, 3, 4];
      this.statusTiers = ["Gold", "Silver", "Brass"];
      this.lores = [];
    }
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "wfrp4e-browser";
      options.template = "systems/wfrp4e/templates/browser/browser.html";
      options.classes.push("wfrp4e", "wfrp-browser");
      options.resizable = true;
      options.height = 900;
      options.width = 600;
      options.minimizable = true;
      options.title = "WFRP Browser";
      return options;
    }
    _getHeaderButtons() {
      let buttons = super._getHeaderButtons();
      if (game.user.isGM) {
        buttons.push(
          {
            class: "import",
            icon: "fas fa-import",
            onclick: async (ev) => this.importResults()
          }
        );
      }
      return buttons;
    }
    async _render(force = false, options = {}) {
      await this.loadItems();
      this._saveScrollPos();
      await super._render(force, options);
      this._setScrollPos();
      this.applyFilter(this._element);
    }
    getData() {
      let data = super.getData();
      data.filters = this.filters;
      data.relations = ["<", "<=", "==", ">=", ">"];
      data.availability = game.wfrp4e.config.availability;
      data.ammunitionGroups = game.wfrp4e.config.ammunitionGroups;
      data.locations = ["Head", "Body", "Arm", "Leg"];
      data.mutationTypes = game.wfrp4e.config.mutationTypes;
      data.armorTypes = game.wfrp4e.config.armorTypes;
      data.gods = this.gods;
      data.weaponGroups = game.wfrp4e.config.weaponGroups;
      data.weaponReaches = game.wfrp4e.config.weaponReaches;
      data.talentMax = game.wfrp4e.config.talentMax;
      data.trappingTypes = game.wfrp4e.config.trappingTypes;
      data.lores = this.lores;
      data.characteristics = game.wfrp4e.config.characteristicsAbbrev;
      data.skillTypes = game.wfrp4e.config.skillTypes;
      data.skillGroup = game.wfrp4e.config.skillGroup;
      data.prayerTypes = game.wfrp4e.config.prayerTypes;
      data.careerGroups = this.careerGroups;
      data.careerClasses = this.careerClasses;
      data.careerTiers = this.careerTiers;
      data.statusTiers = this.statusTiers;
      data.items = this.items;
      return data;
    }
    async loadItems() {
      this.items = [];
      this.filterId = 0;
      let packCount = game.packs.size;
      let packCounter = 0;
      for (let p of game.packs) {
        packCounter++;
        SceneNavigation.displayProgressBar({ label: game.i18n.localize("BROWSER.LoadingBrowser"), pct: packCounter / packCount * 100 });
        if (p.metadata.type == "Item" && (game.user.isGM || !p.private)) {
          await p.getDocuments().then((content) => {
            this.addItems(content);
          });
        }
      }
      this.addItems(game.items.contents.filter((i) => i.permission > 1));
      this.items = this.items.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
      this.lores.push("None");
      this.careerGroups.sort((a, b) => a > b ? 1 : -1);
      this.careerClasses.sort((a, b) => a > b ? 1 : -1);
    }
    addItems(itemList) {
      for (let item of itemList) {
        if (item.type == "career") {
          if (!this.careerGroups.includes(item.system.careergroup.value))
            this.careerGroups.push(item.system.careergroup.value);
          if (!this.careerClasses.includes(item.system.class.value))
            this.careerClasses.push(item.system.class.value);
        }
        if (item.type == "prayer") {
          let godList = item.system.god.value.split(", ").map((i) => {
            return i.trim();
          });
          godList.forEach((god) => {
            if (!this.gods.includes(god))
              this.gods.push(god);
          });
        }
        if (item.type == "spell") {
          if (!this.lores.includes(item.system.lore.value))
            this.lores.push(item.system.lore.value);
        }
        item.filterId = this.filterId;
        this.filterId++;
      }
      this.lores = this.lores.filter((l) => l).sort((a, b) => a > b ? 1 : -1);
      this.lores = this.lores.map((p) => {
        if (game.wfrp4e.config.magicLores[p])
          return game.wfrp4e.config.magicLores[p];
        else
          return p;
      });
      this.items = this.items.concat(itemList);
    }
    applyFilter(html) {
      let items = this.items;
      let noItemFilter = true;
      let filteredItems = [];
      for (let filter in this.filters.type) {
        if (this.filters.type[filter].value) {
          filteredItems = filteredItems.concat(items.filter((i) => i.type == filter));
          noItemFilter = false;
        }
      }
      if (noItemFilter)
        filteredItems = items;
      for (let filter in this.filters.attribute) {
        if (this.filters.attribute[filter] || filter == "worldItems") {
          switch (filter) {
            case "name":
              filteredItems = filteredItems.filter((i) => i.name.toLowerCase().includes(this.filters.attribute.name.toLowerCase()));
              break;
            case "description":
              filteredItems = filteredItems.filter((i) => i.system.description.value && i.system.description.value.toLowerCase().includes(this.filters.attribute.description.toLowerCase()));
              break;
            case "worldItems":
              filteredItems = filteredItems.filter((i) => this.filters.attribute[filter] || !!i.compendium);
              break;
          }
        }
      }
      this.checkDynamicFilters(html);
      for (let filter in this.filters.dynamic) {
        if (this.filters.dynamic[filter].show && this.filters.dynamic[filter].value) {
          switch (filter) {
            case "statusTier":
              filteredItems = filteredItems.filter((i) => !i.system.status || i.system.status && i.system.status.tier.toLowerCase() == this.filters.dynamic[filter].value[0].toLowerCase());
              break;
            case "statusStanding":
              filteredItems = filteredItems.filter((i) => !i.system.status || i.system.status && this.filters.dynamic[filter].relation && (0, eval)(`${i.system.status.standing}${this.filters.dynamic[filter].relation}${this.filters.dynamic[filter].value}`));
              break;
            case "qualitiesFlaws":
              if (this.filters.dynamic[filter].value.length && this.filters.dynamic[filter].value.some((x) => x))
                filteredItems = filteredItems.filter((i) => {
                  if (!i.system.qualities.value.length && !i.system.flaws.value.length)
                    return false;
                  let properties = Object.values(i.properties.qualities).concat(Object.values(i.properties.flaws)).map((i2) => i2.display);
                  if (!properties.length || properties.length == 1 && properties[0] == "Special")
                    return;
                  return this.filters.dynamic[filter].value.every((value) => {
                    return properties.find((v) => v.toLowerCase().includes(value.toLowerCase()));
                  });
                });
              break;
            case "symptoms":
              {
                if (this.filters.dynamic[filter].value.length && this.filters.dynamic[filter].value.some((x) => x))
                  filteredItems = filteredItems.filter((i) => {
                    if (!i.system.symptoms)
                      return true;
                    let s = i.system[filter].value.split(",").map((i2) => {
                      return i2.trim().toLowerCase();
                    });
                    return this.filters.dynamic[filter].value.every((f) => s.find((symptom) => symptom.includes(f.toLowerCase())));
                  });
              }
              break;
            case "characteristics":
            case "skills":
            case "talents":
              if (this.filters.dynamic[filter].value.length && this.filters.dynamic[filter].value.some((x) => x))
                filteredItems = filteredItems.filter((i) => !i.system[filter] || i.system[filter] && this.filters.dynamic[filter].value.every((value) => {
                  return i.system[filter].find((v) => v.toLowerCase().includes(value.toLowerCase()));
                }));
              break;
            case "twohanded":
            case "rollable":
            case "magicMissile":
            case "wearable":
              filteredItems = filteredItems.filter((i) => !i.system[filter] || i.system[filter] && this.filters.dynamic[filter].value == !!i.system[filter].value);
              break;
            case "aoe":
              filteredItems = filteredItems.filter((i) => i.type != "spell" || i.system.target && this.filters.dynamic[filter].value == i.system.target.aoe);
              break;
            case "extendable":
              filteredItems = filteredItems.filter((i) => i.type != "spell" || i.system.duration && this.filters.dynamic[filter].value == i.system.duration.extendable);
              break;
            case "melee":
            case "ranged":
              filteredItems = filteredItems.filter((i) => i.type != "weapon" || filter == game.wfrp4e.config.groupToType[i.system.weaponGroup.value]);
              break;
            case "weaponRange":
              filteredItems = filteredItems.filter((i) => !i.system.range || i.system.range.value && !isNaN(i.system.range.value) && this.filters.dynamic[filter].relation && (0, eval)(`${i.system.range.value}${this.filters.dynamic[filter].relation}${this.filters.dynamic[filter].value}`));
              break;
            case "cn":
            case "carries":
            case "encumbrance":
              filteredItems = filteredItems.filter((i) => !i.system[filter] || i.system[filter] && this.filters.dynamic[filter].relation && (0, eval)(`${i.system[filter].value}${this.filters.dynamic[filter].relation}${this.filters.dynamic[filter].value}`));
              break;
            case "modifiesDamage":
              filteredItems = filteredItems.filter((i) => !i.system.damage || i.system.damage && this.filters.dynamic[filter].value == !!i.system.damage.value);
              break;
            case "modifiesRange":
              filteredItems = filteredItems.filter((i) => !i.system.range || i.system.range && this.filters.dynamic[filter].value == !!i.system.range.value && i.system.range.value.toLowerCase() != "as weapon");
              break;
            case "protects":
              filteredItems = filteredItems.filter((i) => {
                if (!i.system.AP)
                  return true;
                let show;
                if (this.filters.dynamic.protects.value.head && i.system.AP.head)
                  show = true;
                if (this.filters.dynamic.protects.value.body && i.system.AP.body)
                  show = true;
                if (this.filters.dynamic.protects.value.arms && (i.system.AP.lArm || i.system.AP.rArm))
                  show = true;
                if (this.filters.dynamic.protects.value.legs && (i.system.AP.lLeg || i.system.AP.rLeg))
                  show = true;
                return show;
              });
              break;
            case "prayerType":
              filteredItems = filteredItems.filter((i) => !i.system.type || i.system.type && i.system.type.value == this.filters.dynamic.prayerType.value);
              break;
            default:
              if (this.filters.dynamic[filter].exactMatch)
                filteredItems = filteredItems.filter((i) => !i.system[filter] || i.system[filter] && i.system[filter].value.toString().toLowerCase() == this.filters.dynamic[filter].value.toLowerCase());
              else
                filteredItems = filteredItems.filter((i) => !i.system[filter] || i.system[filter] && i.system[filter].value.toString().toLowerCase().includes(this.filters.dynamic[filter].value.toLowerCase()));
              break;
          }
        }
      }
      this.filterIds = filteredItems.map((i) => i.filterId);
      let list = html.find(".browser-item");
      for (let element of list) {
        if (this.filterIds.includes(Number(element.getAttribute("data-filter-id"))))
          $(element).show();
        else
          $(element).hide();
      }
      return filteredItems;
    }
    checkDynamicFilters(html) {
      for (let dynamicFilter in this.filters.dynamic) {
        this.filters.dynamic[dynamicFilter].show = false;
        for (let typeFilter of this.filters.dynamic[dynamicFilter].type) {
          if (this.filters.type[typeFilter].value)
            this.filters.dynamic[dynamicFilter].show = true;
        }
        let filter = html.find(`.${dynamicFilter}`);
        if (this.filters.dynamic[dynamicFilter].show) {
          $(filter).show();
        } else {
          $(filter).hide();
        }
      }
    }
    async importResults() {
      let filteredItems = this.applyFilter(this._element).filter((i) => i.compendium);
      new Dialog({
        title: game.i18n.localize("Import Results"),
        content: `<p>${game.i18n.format("ITEM.Import", { number: filteredItems.length })}`,
        buttons: {
          yes: {
            label: game.i18n.localize("Yes"),
            callback: async (html) => {
              for (let i of filteredItems)
                await Item.create(i.data, { renderSheet: false });
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: (html) => {
              return;
            }
          }
        }
      }).render(true);
    }
    activateListeners(html) {
      html.find(".browser-item").each((i, li) => {
        let item = this.items.find((i2) => i2.id == $(li).attr("data-item-id"));
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", (event2) => {
          let transfer = {
            type: "Item",
            uuid: item.uuid
          };
          event2.dataTransfer.setData("text/plain", JSON.stringify(transfer));
        });
      });
      html.on("click", ".item-name", (ev) => {
        let itemId = $(ev.currentTarget).parents(".browser-item").attr("data-item-id");
        this.items.find((i) => i.id == itemId).sheet.render(true);
      });
      html.on("click", ".filter", (ev) => {
        this.filters.type[$(ev.currentTarget).attr("data-filter")].value = $(ev.currentTarget).is(":checked");
        this.applyFilter(html);
      });
      html.on("keyup", ".name-filter", (ev) => {
        this.filters.attribute.name = $(ev.currentTarget).val();
        this.applyFilter(html);
      });
      html.on("keyup", ".description-filter", (ev) => {
        this.filters.attribute.description = $(ev.currentTarget).val();
        this.applyFilter(html);
      });
      html.on("click", ".world-filter", (ev) => {
        this.filters.attribute.worldItems = $(ev.currentTarget).is(":checked");
        this.applyFilter(html);
      });
      html.on("keyup change", ".dynamic-filter", (ev) => {
        this.filters.dynamic[$(ev.currentTarget).attr("data-filter")].value = $(ev.currentTarget).val();
        this.applyFilter(html);
      });
      html.on("change", ".dynamic-filter-comparator", (ev) => {
        this.filters.dynamic[$(ev.currentTarget).attr("data-filter")].relation = $(ev.currentTarget).val();
        this.applyFilter(html);
      });
      html.on("change", ".csv-filter", (ev) => {
        this.filters.dynamic[$(ev.currentTarget).attr("data-filter")].value = $(ev.currentTarget).val().split(",").map((i) => {
          return i.trim();
        });
        this.applyFilter(html);
      });
      html.on("change", ".boolean-filter", (ev) => {
        if ($(ev.currentTarget).hasClass("exactMatch"))
          this.filters.dynamic[$(ev.currentTarget).attr("data-filter")].exactMatch = $(ev.currentTarget).is(":checked");
        else if ($(ev.currentTarget).attr("data-filter"))
          this.filters.dynamic[$(ev.currentTarget).attr("data-filter")].value = $(ev.currentTarget).is(":checked");
        this.applyFilter(html);
      });
      html.on("click", ".protects-filter", (ev) => {
        this.filters.dynamic.protects.value[$(ev.currentTarget).attr("data-filter")] = $(ev.currentTarget).is(":checked");
        this.applyFilter(html);
      });
    }
    _saveScrollPos() {
      if (this.form === null)
        return;
      const html = this._element;
      if (!html)
        return;
      this.scrollPos = [];
      let lists = $(html.find(".save-scroll"));
      for (let list of lists) {
        this.scrollPos.push($(list).scrollTop());
      }
    }
    _setScrollPos() {
      if (this.scrollPos) {
        const html = this._element;
        let lists = $(html.find(".save-scroll"));
        for (let i = 0; i < lists.length; i++) {
          $(lists[i]).scrollTop(this.scrollPos[i]);
        }
      }
    }
  };
  Hooks.on("renderCompendiumDirectory", (app, html, data) => {
    if (game.user.isGM || game.settings.get("wfrp4e", "playerBrowser")) {
      const button = $(`<button class="browser-btn" data-tooltip="${game.i18n.localize("BROWSER.Button")}"><i class="fa-solid fa-filter"></i></button>`);
      html.find(".header-actions").append(button);
      button.click((ev) => {
        game.wfrpbrowser.render(true);
      });
    }
  });
  Hooks.on("init", () => {
    if (!game.wfrpbrowser)
      game.wfrpbrowser = new BrowserWfrp4e();
  });

  // modules/system/config-wfrp4e.js
  var WFRP4E = {};
  CONFIG.ChatMessage.template = "systems/wfrp4e/templates/chat/chat-message.html";
  WFRP4E.creditOptions = {
    SPLIT: "split",
    EACH: "each"
  };
  WFRP4E.toTranslate = [
    "statusTiers",
    "characteristics",
    "characteristicsAbbrev",
    "characteristicsBonus",
    "skillTypes",
    "skillGroup",
    "talentMax",
    "weaponGroups",
    "weaponTypes",
    "weaponReaches",
    "ammunitionGroups",
    "itemQualities",
    "itemFlaws",
    "weaponQualities",
    "weaponFlaws",
    "armorQualities",
    "armorFlaws",
    "armorTypes",
    "rangeModifiers",
    "rangeBands",
    "difficultyLabels",
    "locations",
    "availability",
    "trappingTypes",
    "trappingCategories",
    "actorSizes",
    "magicLores",
    "magicWind",
    "prayerTypes",
    "mutationTypes",
    "conditions",
    "availabilityTable",
    "moneyNames",
    "hitLocationTables",
    "extendedTestCompletion",
    "effectApplication",
    "applyScope"
  ];
  CONFIG.controlIcons.defeated = "systems/wfrp4e/icons/defeated.png";
  CONFIG.JournalEntry.noteIcons = {
    "Marker": "systems/wfrp4e/icons/buildings/point_of_interest.png",
    "Apothecary": "systems/wfrp4e/icons/buildings/apothecary.png",
    "Beastmen Herd 1": "systems/wfrp4e/icons/buildings/beastmen_camp1.png",
    "Beastmen Herd 2": "systems/wfrp4e/icons/buildings/beastmen_camp2.png",
    "Blacksmith": "systems/wfrp4e/icons/buildings/blacksmith.png",
    "Bretonnian City 1": "systems/wfrp4e/icons/buildings/bret_city1.png",
    "Bretonnian City 2": "systems/wfrp4e/icons/buildings/bret_city2.png",
    "Bretonnian City 3": "systems/wfrp4e/icons/buildings/bret_city3.png",
    "Bretonnian Worship": "systems/wfrp4e/icons/buildings/bretonnia_worship.png",
    "Caste Hill 1": "systems/wfrp4e/icons/buildings/castle_hill1.png",
    "Caste Hill 2": "systems/wfrp4e/icons/buildings/castle_hill2.png",
    "Caste Hill 3": "systems/wfrp4e/icons/buildings/castle_hill3.png",
    "Castle Wall": "systems/wfrp4e/icons/buildings/castle_wall.png",
    "Cave 1": "systems/wfrp4e/icons/buildings/cave1.png",
    "Cave 2": "systems/wfrp4e/icons/buildings/cave2.png",
    "Cave 3": "systems/wfrp4e/icons/buildings/cave3.png",
    "Cemetery": "systems/wfrp4e/icons/buildings/cemetery.png",
    "Chaos Portal": "systems/wfrp4e/icons/buildings/chaos_portal.png",
    "Chaos Worship": "systems/wfrp4e/icons/buildings/chaos_worship.png",
    "Court": "systems/wfrp4e/icons/buildings/court.png",
    "Dwarf Beer": "systems/wfrp4e/icons/buildings/dwarf_beer.png",
    "Dwarf Hold 1": "systems/wfrp4e/icons/buildings/dwarf_hold1.png",
    "Dwarf Hold 2": "systems/wfrp4e/icons/buildings/dwarf_hold2.png",
    "Dwarf Hold 3": "systems/wfrp4e/icons/buildings/dwarf_hold3.png",
    "Empire Barracks": "systems/wfrp4e/icons/buildings/empire_barracks.png",
    "Empire City 1": "systems/wfrp4e/icons/buildings/empire_city1.png",
    "Empire City 2": "systems/wfrp4e/icons/buildings/empire_city2.png",
    "Empire City 3": "systems/wfrp4e/icons/buildings/empire_city3.png",
    "Farm": "systems/wfrp4e/icons/buildings/farms.png",
    "Food 1": "systems/wfrp4e/icons/buildings/food.png",
    "Food 2": "systems/wfrp4e/icons/buildings/food2.png",
    "Guard Post": "systems/wfrp4e/icons/buildings/guards.png",
    "Haunted Hill": "systems/wfrp4e/icons/buildings/haunted_hill.png",
    "Haunted Wood": "systems/wfrp4e/icons/buildings/haunted_wood.png",
    "Inn 1": "systems/wfrp4e/icons/buildings/inn1.png",
    "Inn 2": "systems/wfrp4e/icons/buildings/inn2.png",
    "Kislev City 1": "systems/wfrp4e/icons/buildings/kislev_city1.png",
    "Kislev City 2": "systems/wfrp4e/icons/buildings/kislev_city2.png",
    "Kislev City 3": "systems/wfrp4e/icons/buildings/kislev_city3.png",
    "Lumber": "systems/wfrp4e/icons/buildings/lumber.png",
    "Magic": "systems/wfrp4e/icons/buildings/magic.png",
    "Metal": "systems/wfrp4e/icons/buildings/metal.png",
    "Mountain 1": "systems/wfrp4e/icons/buildings/mountains1.png",
    "Mountain 2": "systems/wfrp4e/icons/buildings/mountains2.png",
    "Orcs": "systems/wfrp4e/icons/buildings/orcs.png",
    "Orc Camp": "systems/wfrp4e/icons/buildings/orc_city.png",
    "Port": "systems/wfrp4e/icons/buildings/port.png",
    "Road": "systems/wfrp4e/icons/buildings/roads.png",
    "Ruins": "systems/wfrp4e/icons/buildings/ruins.png",
    "Scroll": "systems/wfrp4e/icons/buildings/scroll.png",
    "Sigmar": "systems/wfrp4e/icons/buildings/sigmar_worship.png",
    "Stables": "systems/wfrp4e/icons/buildings/stables.png",
    "Standing Stones": "systems/wfrp4e/icons/buildings/standing_stones.png",
    "Swamp": "systems/wfrp4e/icons/buildings/swamp.png",
    "Temple": "systems/wfrp4e/icons/buildings/temple.png",
    "Textile": "systems/wfrp4e/icons/buildings/textile.png",
    "Tower 1": "systems/wfrp4e/icons/buildings/tower1.png",
    "Tower 2": "systems/wfrp4e/icons/buildings/tower2.png",
    "Tower Hill": "systems/wfrp4e/icons/buildings/tower_hill.png",
    "Wizard Tower": "systems/wfrp4e/icons/buildings/wizard_tower.png",
    "Ulric": "systems/wfrp4e/icons/buildings/ulric_worship.png",
    "Village 1": "systems/wfrp4e/icons/buildings/village1.png",
    "Village 2": "systems/wfrp4e/icons/buildings/village2.png",
    "Village 3": "systems/wfrp4e/icons/buildings/village3.png",
    "Wood Elves 1": "systems/wfrp4e/icons/buildings/welves1.png",
    "Wood Elves 2": "systems/wfrp4e/icons/buildings/welves2.png",
    "Wood Elves 3": "systems/wfrp4e/icons/buildings/welves3.png"
  };
  CONFIG.TextEditor.enrichers = CONFIG.TextEditor.enrichers.concat([
    {
      pattern: /@Table\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("table-click");
        a.dataset.table = match[1];
        a.innerHTML = `<i class="fas fa-list"></i>${game.wfrp4e.tables.findTable(match[1])?.name && !match[2] ? game.wfrp4e.tables.findTable(match[1])?.name : match[2]}`;
        return a;
      }
    },
    {
      pattern: /@Symptom\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("symptom-tag");
        a.dataset.symptom = match[1];
        let id = match[1];
        let label = match[2];
        a.innerHTML = `<i class="fas fa-user-injured"></i>${label ? label : id}`;
        return a;
      }
    },
    {
      pattern: /@Condition\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("condition-chat");
        a.dataset.cond = match[1];
        let id = match[1];
        let label = match[2];
        a.innerHTML = `<i class="fas fa-user-injured"></i>${label ? label : id}`;
        return a;
      }
    },
    {
      pattern: /@Pay\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("pay-link");
        a.dataset.pay = match[1];
        let id = match[1];
        let label = match[2];
        a.innerHTML = `<i class="fas fa-coins"></i>${label ? label : id}`;
        return a;
      }
    },
    {
      pattern: /@Credit\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("credit-link");
        a.dataset.credit = match[1];
        let id = match[1];
        let label = match[2];
        a.innerHTML = `<i class="fas fa-coins"></i>${label ? label : id}`;
        return a;
      }
    },
    {
      pattern: /@Corruption\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        const a = document.createElement("a");
        a.classList.add("corruption-link");
        a.dataset.strength = match[1];
        let id = match[1];
        let label = match[2];
        a.innerHTML = `<img src="systems/wfrp4e/ui/chaos.svg" height=15px width=15px style="border:none">${label ? label : id}`;
        return a;
      }
    },
    {
      pattern: /@Fear\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        let values = match[1].split(",");
        const a = document.createElement("a");
        a.classList.add("fear-link");
        a.dataset.value = values[0];
        a.dataset.name = values[1] || "";
        a.innerHTML = `<img src="systems/wfrp4e/ui/fear.svg" height=15px width=15px style="border:none"> ${game.i18n.localize("WFRP4E.ConditionName.Fear")} ${values[0]}`;
        return a;
      }
    },
    {
      pattern: /@Terror\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        let values = match[1].split(",");
        const a = document.createElement("a");
        a.classList.add("terror-link");
        a.dataset.value = values[0];
        a.dataset.name = values[1] || "";
        a.innerHTML = `<img src="systems/wfrp4e/ui/terror.svg" height=15px width=15px style="border:none"> ${game.i18n.localize("NAME.Terror")} ${values[0]}`;
        return a;
      }
    },
    {
      pattern: /@Exp\[(.+?)\](?:{(.+?)})?/gm,
      enricher: (match, options) => {
        let values = match[1].split(",");
        const a = document.createElement("a");
        a.classList.add("exp-link");
        a.dataset.amount = values[0];
        a.dataset.reason = values[1] || "";
        let label = match[2];
        a.innerHTML = `<i class="fas fa-plus"></i> ${label ? label : values[1] || values[0]}</a>`;
        return a;
      }
    }
  ]);
  WFRP4E.statusTiers = {
    "g": "TIER.Gold",
    "s": "TIER.Silver",
    "b": "TIER.Brass"
  };
  WFRP4E.characteristics = {
    "ws": "CHAR.WS",
    "bs": "CHAR.BS",
    "s": "CHAR.S",
    "t": "CHAR.T",
    "i": "CHAR.I",
    "ag": "CHAR.Ag",
    "dex": "CHAR.Dex",
    "int": "CHAR.Int",
    "wp": "CHAR.WP",
    "fel": "CHAR.Fel"
  };
  WFRP4E.characteristicsAbbrev = {
    "ws": "CHARAbbrev.WS",
    "bs": "CHARAbbrev.BS",
    "s": "CHARAbbrev.S",
    "t": "CHARAbbrev.T",
    "i": "CHARAbbrev.I",
    "ag": "CHARAbbrev.Ag",
    "dex": "CHARAbbrev.Dex",
    "int": "CHARAbbrev.Int",
    "wp": "CHARAbbrev.WP",
    "fel": "CHARAbbrev.Fel"
  };
  WFRP4E.characteristicsBonus = {
    "ws": "CHARBonus.WS",
    "bs": "CHARBonus.BS",
    "s": "CHARBonus.S",
    "t": "CHARBonus.T",
    "i": "CHARBonus.I",
    "ag": "CHARBonus.Ag",
    "dex": "CHARBonus.Dex",
    "int": "CHARBonus.Int",
    "wp": "CHARBonus.WP",
    "fel": "CHARBonus.Fel"
  };
  WFRP4E.skillTypes = {
    "bsc": "Basic",
    "adv": "Advanced"
  };
  WFRP4E.xpCost = {
    "characteristic": [25, 30, 40, 50, 70, 90, 120, 150, 190, 230, 280, 330, 390, 450, 520],
    "skill": [10, 15, 20, 30, 40, 60, 80, 110, 140, 180, 220, 270, 320, 380, 440]
  };
  WFRP4E.skillGroup = {
    "isSpec": "ITEM.IsSpec",
    "noSpec": "ITEM.NoSpec"
  };
  WFRP4E.talentMax = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "none": "None",
    "ws": "CHARBonus.WS",
    "bs": "CHARBonus.BS",
    "s": "CHARBonus.S",
    "t": "CHARBonus.T",
    "i": "CHARBonus.I",
    "ag": "CHARBonus.Ag",
    "dex": "CHARBonus.Dex",
    "int": "CHARBonus.Int",
    "wp": "CHARBonus.WP",
    "fel": "CHARBonus.Fel"
  };
  WFRP4E.weaponGroups = {
    "basic": "SPEC.Basic",
    "cavalry": "SPEC.Cavalry",
    "fencing": "SPEC.Fencing",
    "brawling": "SPEC.Brawling",
    "flail": "SPEC.Flail",
    "parry": "SPEC.Parry",
    "polearm": "SPEC.Polearm",
    "twohanded": "SPEC.TwoHanded",
    "blackpowder": "SPEC.Blackpowder",
    "bow": "SPEC.Bow",
    "crossbow": "SPEC.Crossbow",
    "entangling": "SPEC.Entangling",
    "engineering": "SPEC.Engineering",
    "explosives": "SPEC.Explosives",
    "sling": "SPEC.Sling",
    "throwing": "SPEC.Throwing",
    "vehicle": "SPEC.Vehicle"
  };
  WFRP4E.groupToType = {
    "basic": "melee",
    "cavalry": "melee",
    "fencing": "melee",
    "brawling": "melee",
    "flail": "melee",
    "parry": "melee",
    "polearm": "melee",
    "twohanded": "melee",
    "blackpowder": "ranged",
    "bow": "ranged",
    "crossbow": "ranged",
    "entangling": "ranged",
    "engineering": "ranged",
    "explosives": "ranged",
    "sling": "ranged",
    "throwing": "ranged",
    "vehicle": "ranged"
  };
  WFRP4E.weaponTypes = {
    "melee": "Melee",
    "ranged": "Ranged"
  };
  WFRP4E.weaponReaches = {
    "personal": "WFRP4E.Reach.Personal",
    "vshort": "WFRP4E.Reach.VShort",
    "short": "WFRP4E.Reach.Short",
    "average": "WFRP4E.Reach.Average",
    "long": "WFRP4E.Reach.Long",
    "vLong": "WFRP4E.Reach.VLong",
    "massive": "WFRP4E.Reach.Massive"
  };
  WFRP4E.ammunitionGroups = {
    "BPandEng": "WFRP4E.BPandEng",
    "bow": "WFRP4E.Bow",
    "crossbow": "WFRP4E.Crossbow",
    "sling": "WFRP4E.Sling",
    "vehicle": "WFRP4E.Vehicle",
    "throwing": "SPEC.Throwing"
  };
  WFRP4E.itemQualities = {
    "durable": "PROPERTY.Durable",
    "fine": "PROPERTY.Fine",
    "lightweight": "PROPERTY.Lightweight",
    "practical": "PROPERTY.Practical"
  };
  WFRP4E.itemFlaws = {
    "ugly": "PROPERTY.Ugly",
    "shoddy": "PROPERTY.Shoddy",
    "unreliable": "PROPERTY.Unreliable",
    "bulky": "PROPERTY.Bulky"
  };
  WFRP4E.weaponQualities = {
    "accurate": "PROPERTY.Accurate",
    "blackpowder": "PROPERTY.Blackpowder",
    "blast": "PROPERTY.Blast",
    "damaging": "PROPERTY.Damaging",
    "defensive": "PROPERTY.Defensive",
    "distract": "PROPERTY.Distract",
    "entangle": "PROPERTY.Entangle",
    "fast": "PROPERTY.Fast",
    "hack": "PROPERTY.Hack",
    "impact": "PROPERTY.Impact",
    "impale": "PROPERTY.Impale",
    "penetrating": "PROPERTY.Penetrating",
    "pistol": "PROPERTY.Pistol",
    "precise": "PROPERTY.Precise",
    "pummel": "PROPERTY.Pummel",
    "repeater": "PROPERTY.Repeater",
    "shield": "PROPERTY.Shield",
    "trapblade": "PROPERTY.TrapBlade",
    "unbreakable": "PROPERTY.Unbreakable",
    "wrap": "PROPERTY.Wrap"
  };
  WFRP4E.weaponFlaws = {
    "dangerous": "PROPERTY.Dangerous",
    "imprecise": "PROPERTY.Imprecise",
    "reload": "PROPERTY.Reload",
    "slow": "PROPERTY.Slow",
    "tiring": "PROPERTY.Tiring",
    "undamaging": "PROPERTY.Undamaging"
  };
  WFRP4E.armorQualities = {
    "flexible": "PROPERTY.Flexible",
    "impenetrable": "PROPERTY.Impenetrable"
  };
  WFRP4E.armorFlaws = {
    "partial": "PROPERTY.Partial",
    "weakpoints": "PROPERTY.Weakpoints"
  };
  WFRP4E.propertyHasValue = {
    "durable": true,
    "fine": true,
    "lightweight": false,
    "practical": false,
    "ugly": false,
    "shoddy": false,
    "unreliable": false,
    "bulky": false,
    "accurate": false,
    "blackpowder": false,
    "blast": true,
    "damaging": false,
    "defensive": false,
    "distract": false,
    "entangle": false,
    "fast": false,
    "hack": false,
    "impact": false,
    "impale": false,
    "penetrating": false,
    "pistol": false,
    "precise": false,
    "pummel": false,
    "repeater": true,
    "shield": true,
    "trapblade": false,
    "unbreakable": false,
    "wrap": false,
    "dangerous": false,
    "imprecise": false,
    "reload": true,
    "slow": false,
    "tiring": false,
    "undamaging": false,
    "flexible": false,
    "impenetrable": false,
    "partial": false,
    "weakpoints": false
  };
  WFRP4E.armorTypes = {
    "softLeather": "WFRP4E.ArmourType.SLeather",
    "boiledLeather": "WFRP4E.ArmourType.BLeather",
    "mail": "WFRP4E.ArmourType.Mail",
    "plate": "WFRP4E.ArmourType.Plate",
    "other": "WFRP4E.ArmourType.Other"
  };
  WFRP4E.rangeModifiers = {
    "Point Blank": "easy",
    "Short Range": "average",
    "Normal": "challenging",
    "Long Range": "difficult",
    "Extreme": "vhard"
  };
  WFRP4E.rangeBands = {
    "pb": "Point Blank",
    "short": "Short Range",
    "normal": "Normal",
    "long": "Long Range",
    "extreme": "Extreme"
  };
  WFRP4E.difficultyModifiers = {
    "veasy": 60,
    "easy": 40,
    "average": 20,
    "challenging": 0,
    "difficult": -10,
    "hard": -20,
    "vhard": -30
  };
  WFRP4E.difficultyLabels = {
    "veasy": "DIFFICULTY.VEasy",
    "easy": "DIFFICULTY.Easy",
    "average": "DIFFICULTY.Average",
    "challenging": "DIFFICULTY.Challenging",
    "difficult": "DIFFICULTY.Difficult",
    "hard": "DIFFICULTY.Hard",
    "vhard": "DIFFICULTY.VHard"
  };
  WFRP4E.locations = {
    "head": "WFRP4E.Locations.head",
    "body": "WFRP4E.Locations.body",
    "rArm": "WFRP4E.Locations.rArm",
    "lArm": "WFRP4E.Locations.lArm",
    "rLeg": "WFRP4E.Locations.rLeg",
    "lLeg": "WFRP4E.Locations.lLeg"
  };
  WFRP4E.availability = {
    "None": "-",
    "common": "WFRP4E.Availability.Common",
    "scarce": "WFRP4E.Availability.Scarce",
    "rare": "WFRP4E.Availability.Rare",
    "exotic": "WFRP4E.Availability.Exotic",
    "special": "WFRP4E.Availability.Special"
  };
  WFRP4E.trappingTypes = {
    "clothingAccessories": "WFRP4E.TrappingType.ClothingAccessories",
    "foodAndDrink": "WFRP4E.TrappingType.FoodDrink",
    "toolsAndKits": "WFRP4E.TrappingType.ToolsKits",
    "booksAndDocuments": "WFRP4E.TrappingType.BooksDocuments",
    "tradeTools": "WFRP4E.TrappingType.TradeTools",
    "drugsPoisonsHerbsDraughts": "WFRP4E.TrappingType.DrugsPoisonsHerbsDraughts",
    "ingredient": "WFRP4E.TrappingType.Ingredient",
    "misc": "WFRP4E.TrappingType.Misc"
  };
  WFRP4E.trappingCategories = {
    "weapon": "WFRP4E.TrappingType.Weapon",
    "armour": "WFRP4E.TrappingType.Armour",
    "money": "WFRP4E.TrappingType.Money",
    "ammunition": "WFRP4E.TrappingType.Ammunition",
    "container": "WFRP4E.TrappingType.Container",
    "clothingAccessories": "WFRP4E.TrappingType.ClothingAccessories",
    "foodAndDrink": "WFRP4E.TrappingType.FoodDrink",
    "toolsAndKits": "WFRP4E.TrappingType.ToolsKits",
    "booksAndDocuments": "WFRP4E.TrappingType.BooksDocuments",
    "tradeTools": "WFRP4E.TrappingType.TradeTools",
    "drugsPoisonsHerbsDraughts": "WFRP4E.TrappingType.DrugsPoisonsHerbsDraughts",
    "ingredient": "WFRP4E.TrappingType.Ingredient",
    "misc": "WFRP4E.TrappingType.Misc"
  };
  WFRP4E.actorSizes = {
    "tiny": "SPEC.Tiny",
    "ltl": "SPEC.Little",
    "sml": "SPEC.Small",
    "avg": "SPEC.Average",
    "lrg": "SPEC.Large",
    "enor": "SPEC.Enormous",
    "mnst": "SPEC.Monstrous"
  };
  WFRP4E.actorSizeNums = {
    "tiny": 0,
    "ltl": 1,
    "sml": 2,
    "avg": 3,
    "lrg": 4,
    "enor": 5,
    "mnst": 6
  };
  WFRP4E.tokenSizes = {
    "tiny": 0.3,
    "ltl": 0.5,
    "sml": 0.8,
    "avg": 1,
    "lrg": 2,
    "enor": 3,
    "mnst": 4
  };
  WFRP4E.magicLores = {
    "petty": "WFRP4E.MagicLores.petty",
    "beasts": "WFRP4E.MagicLores.beasts",
    "death": "WFRP4E.MagicLores.death",
    "fire": "WFRP4E.MagicLores.fire",
    "heavens": "WFRP4E.MagicLores.heavens",
    "metal": "WFRP4E.MagicLores.metal",
    "life": "WFRP4E.MagicLores.life",
    "light": "WFRP4E.MagicLores.light",
    "shadow": "WFRP4E.MagicLores.shadow",
    "hedgecraft": "WFRP4E.MagicLores.hedgecraft",
    "witchcraft": "WFRP4E.MagicLores.witchcraft",
    "daemonology": "WFRP4E.MagicLores.daemonology",
    "necromancy": "WFRP4E.MagicLores.necromancy",
    "undivided": "WFRP4E.MagicLores.undivided",
    "nurgle": "WFRP4E.MagicLores.nurgle",
    "slaanesh": "WFRP4E.MagicLores.slaanesh",
    "tzeentch": "WFRP4E.MagicLores.tzeentch"
  };
  WFRP4E.magicWind = {
    "petty": "WFRP4E.MagicWind.petty",
    "beasts": "WFRP4E.MagicWind.beasts",
    "death": "WFRP4E.MagicWind.death",
    "fire": "WFRP4E.MagicWind.fire",
    "heavens": "WFRP4E.MagicWind.heavens",
    "metal": "WFRP4E.MagicWind.metal",
    "life": "WFRP4E.MagicWind.life",
    "light": "WFRP4E.MagicWind.light",
    "shadow": "WFRP4E.MagicWind.shadow",
    "hedgecraft": "WFRP4E.MagicWind.hedgecraft",
    "witchcraft": "WFRP4E.MagicWind.witchcraft",
    "daemonology": "WFRP4E.MagicWind.daemonology",
    "necromancy": "WFRP4E.MagicWind.necromancy",
    "undivided": "WFRP4E.MagicWind.undivided",
    "nurgle": "WFRP4E.MagicWind.nurgle",
    "slaanesh": "WFRP4E.MagicWind.slaanesh",
    "tzeentch": "WFRP4E.MagicWind.tzeentch"
  };
  WFRP4E.prayerTypes = {
    "blessing": "WFRP4E.prayerTypes.blessing",
    "miracle": "WFRP4E.prayerTypes.miracle"
  };
  WFRP4E.mutationTypes = {
    "physical": "WFRP4E.mutationTypes.physical",
    "mental": "WFRP4E.mutationTypes.mental"
  };
  WFRP4E.conditions = {
    "ablaze": "WFRP4E.ConditionName.Ablaze",
    "bleeding": "WFRP4E.ConditionName.Bleeding",
    "blinded": "WFRP4E.ConditionName.Blinded",
    "broken": "WFRP4E.ConditionName.Broken",
    "deafened": "WFRP4E.ConditionName.Deafened",
    "entangled": "WFRP4E.ConditionName.Entangled",
    "fatigued": "WFRP4E.ConditionName.Fatigued",
    "poisoned": "WFRP4E.ConditionName.Poisoned",
    "prone": "WFRP4E.ConditionName.Prone",
    "stunned": "WFRP4E.ConditionName.Stunned",
    "surprised": "WFRP4E.ConditionName.Surprised",
    "unconscious": "WFRP4E.ConditionName.Unconscious",
    "grappling": "WFRP4E.ConditionName.Grappling",
    "fear": "WFRP4E.ConditionName.Fear",
    "defeated": "WFRP4E.ConditionName.Defeated"
  };
  WFRP4E.earningValues = {
    "b": "2d10",
    "s": "1d10",
    "g": "1"
  };
  WFRP4E.randomExp = {
    speciesRand: 20,
    careerRand: 50,
    careerReroll: 25,
    statsRand: 50,
    statsReorder: 25
  };
  WFRP4E.reachNum = {
    "personal": 1,
    "vshort": 2,
    "short": 3,
    "average": 4,
    "long": 5,
    "vLong": 6,
    "massive": 7
  };
  WFRP4E.traitBonuses = {
    "big": {
      "s": 10,
      "t": 10,
      "ag": -5
    },
    "brute": {
      "m": -1,
      "t": 10,
      "s": 10,
      "ag": -10
    },
    "clever": {
      "int": 20,
      "i": 10
    },
    "cunning": {
      "int": 10,
      "fel": 10,
      "i": 10
    },
    "elite": {
      "ws": 20,
      "bs": 20,
      "wp": 20
    },
    "fast": {
      "ag": 10,
      "m": 1
    },
    "leader": {
      "fel": 10,
      "wp": 10
    },
    "tough": {
      "t": 10,
      "wp": 10
    },
    "swarm": {
      "ws": 10
    }
  };
  WFRP4E.talentBonuses = {
    "savvy": "int",
    "suave": "fel",
    "marksman": "bs",
    "very strong": "s",
    "sharp": "i",
    "lightning reflexes": "ag",
    "coolheaded": "wp",
    "very resilient": "t",
    "nimble fingered": "dex",
    "warrior born": "ws"
  };
  WFRP4E.corruptionTables = ["mutatephys", "mutatemental"];
  WFRP4E.DAMAGE_TYPE = {
    NORMAL: 0,
    IGNORE_AP: 1,
    IGNORE_TB: 2,
    IGNORE_ALL: 3
  };
  WFRP4E.PSEUDO_ENTITIES = [
    "Table",
    "Condition",
    "Symptom",
    "Roll",
    "Pay",
    "Credit",
    "Corruption",
    "Fear",
    "Terror",
    "Exp"
  ];
  WFRP4E.availabilityTable = {
    "MARKET.Village": {
      "WFRP4E.Availability.Common": {
        test: 100,
        stock: "2"
      },
      "WFRP4E.Availability.Scarce": {
        test: 30,
        stock: "1"
      },
      "WFRP4E.Availability.Rare": {
        test: 15,
        stock: "1"
      },
      "WFRP4E.Availability.Exotic": {
        test: 0,
        stock: "0"
      }
    },
    "MARKET.Town": {
      "WFRP4E.Availability.Common": {
        test: 100,
        stock: "2d10"
      },
      "WFRP4E.Availability.Scarce": {
        test: 60,
        stock: "1d10"
      },
      "WFRP4E.Availability.Rare": {
        test: 30,
        stock: "1d5"
      },
      "WFRP4E.Availability.Exotic": {
        test: 0,
        stock: "0"
      }
    },
    "MARKET.City": {
      "WFRP4E.Availability.Common": {
        test: 100,
        stock: "\u221E"
      },
      "WFRP4E.Availability.Scarce": {
        test: 90,
        stock: "\u221E"
      },
      "WFRP4E.Availability.Rare": {
        test: 45,
        stock: "\u221E"
      },
      "WFRP4E.Availability.Exotic": {
        test: 0,
        stock: "0"
      }
    }
  };
  WFRP4E.species = {};
  WFRP4E.subspecies = {};
  WFRP4E.speciesCharacteristics = {};
  WFRP4E.speciesSkills = {};
  WFRP4E.speciesTalents = {};
  WFRP4E.speciesMovement = {};
  WFRP4E.speciesFate = {};
  WFRP4E.speciesRes = {};
  WFRP4E.speciesExtra = {};
  WFRP4E.speciesAge = {};
  WFRP4E.speciesHeight = {};
  WFRP4E.classTrappings = {};
  WFRP4E.weaponGroupDescriptions = {};
  WFRP4E.reachDescription = {};
  WFRP4E.qualityDescriptions = {};
  WFRP4E.flawDescriptions = {};
  WFRP4E.loreEffectDescriptions = {};
  WFRP4E.loreEffects = {};
  WFRP4E.conditionDescriptions = {};
  WFRP4E.symptoms = {};
  WFRP4E.symptomDescriptions = {};
  WFRP4E.symptomTreatment = {};
  WFRP4E.conditionDescriptions = {};
  WFRP4E.modTypes = {};
  WFRP4E.symptomEffects = {};
  WFRP4E.trade = {};
  WFRP4E.moneyNames = {
    "gc": "NAME.GC",
    "ss": "NAME.SS",
    "bp": "NAME.BP"
  };
  WFRP4E.moneyValues = {
    "gc": 240,
    "ss": 20,
    "bp": 1
  };
  WFRP4E.hitLocationTables = {
    "hitloc": "WFRP4E.hitLocationTables.hitloc",
    "snake": "WFRP4E.hitLocationTables.snake",
    "spider": "WFRP4E.hitLocationTables.spider"
  };
  WFRP4E.extendedTestCompletion = {
    none: "ExtendedTest.None",
    reset: "ExtendedTest.Reset",
    remove: "ExtendedTest.Remove"
  };
  WFRP4E.actorSizeEncumbrance = {
    "tiny": 0,
    "ltl": 2,
    "sml": 5,
    "avg": 10,
    "lrg": 20,
    "enor": 40,
    "mnst": 100
  };
  WFRP4E.systemItems = {};
  WFRP4E.systemEffects = {};
  WFRP4E.PrepareSystemItems = function() {
    this.systemItems = mergeObject(this.systemItems, {
      reload: {
        type: "extendedTest",
        name: "",
        system: {
          SL: {},
          test: {
            value: ""
          },
          completion: {
            value: "remove"
          }
        },
        flags: {
          wfrp4e: {
            reloading: ""
          }
        }
      },
      improv: {
        name: game.i18n.localize("NAME.Improvised"),
        type: "weapon",
        effects: [],
        system: {
          damage: { value: "SB + 1" },
          reach: { value: "personal" },
          weaponGroup: { value: "basic" },
          twohanded: { value: false },
          qualities: { value: [] },
          flaws: { value: [{ name: "undamaging" }] },
          special: { value: "" },
          range: { value: "" },
          ammunitionGroup: { value: "" },
          offhand: { value: false }
        }
      },
      stomp: {
        name: game.i18n.localize("NAME.Stomp"),
        type: "trait",
        effects: [],
        system: {
          specification: { value: "4" },
          rollable: { value: true, rollCharacteristic: "ws", bonusCharacteristic: "s", defaultDifficulty: "challenging", damage: true, skill: game.i18n.localize("NAME.MeleeBrawling") }
        }
      },
      unarmed: {
        name: game.i18n.localize("NAME.Unarmed"),
        type: "weapon",
        effects: [],
        system: {
          damage: { value: "SB + 0" },
          reach: { value: "personal" },
          weaponGroup: { value: "brawling" },
          twohanded: { value: false },
          qualities: { value: [] },
          flaws: { value: [{ name: "undamaging" }] },
          special: { value: "" },
          range: { value: "" },
          ammunitionGroup: { value: "" },
          offhand: { value: false }
        }
      },
      fear: {
        name: game.i18n.localize("NAME.Fear"),
        type: "extendedTest",
        system: {
          completion: { value: "remove" },
          description: { type: "String", label: "Description", value: "" },
          failingDecreases: { value: true },
          gmdescription: { type: "String", label: "Description", value: "" },
          hide: { test: false, progress: false },
          negativePossible: { value: false },
          SL: { current: 0, target: 1 },
          test: { value: game.i18n.localize("NAME.Cool") }
        },
        effects: [
          {
            label: game.i18n.localize("NAME.Fear"),
            icon: "systems/wfrp4e/icons/conditions/fear.png",
            transfer: true,
            flags: {
              core: {
                statusId: "fear"
              },
              wfrp4e: {
                "effectTrigger": "dialogChoice",
                "effectData": {
                  "description": game.i18n.localize("EFFECT.TestsToAffect"),
                  "slBonus": "-1"
                },
                "script": `
                                if (this.flags.wfrp4e.fearName)
                                    this.flags.wfrp4e.effectData.description += " " + this.flags.wfrp4e.fearName
                                else
                                    this.flags.wfrp4e.effectData.description += " " + game.i18n.localize("EFFECT.TheSourceOfFear")
                            `
              }
            }
          }
        ]
      },
      terror: {
        label: game.i18n.localize("NAME.Terror"),
        icon: "systems/wfrp4e/icons/conditions/terror.png",
        transfer: true,
        flags: {
          wfrp4e: {
            "effectTrigger": "oneTime",
            "effectApplication": "actor",
            "terrorValue": 1,
            "script": `
                        let skillName = game.i18n.localize("NAME.Cool");
                        args.actor.setupSkill(skillName).then(setupData =>{
                        args.actor.basicTest(setupData).then(test => {
                            let terror = this.effect.flags.wfrp4e.terrorValue;   
                            args.actor.applyFear(terror, name)
                            if (test.result.outcome == "failure")
                            {            
                                if (test.result.SL < 0)
                                    terror += Math.abs(test.result.SL)
                    
                                args.actor.addCondition("broken", terror)
                            }
                            })
                        })`
          }
        }
      }
    });
    this.systemEffects = mergeObject(this.systemEffects, {
      "enc1": {
        label: game.i18n.localize("EFFECT.Encumbrance") + " 1",
        icon: "systems/wfrp4e/icons/effects/enc1.png",
        flags: {
          wfrp4e: {
            "effectTrigger": "prePrepareData",
            "effectApplication": "actor",
            "script": `
                        args.actor.characteristics.ag.modifier -= 10;

                        if (args.actor.details.move.value > 3)
                        {
                            args.actor.details.move.value -= 1;
                            if (args.actor.details.move.value < 3)
                                args.actor.details.move.value = 3
                        }
                        `
          }
        }
      },
      "enc2": {
        label: game.i18n.localize("EFFECT.Encumbrance") + " 2",
        icon: "systems/wfrp4e/icons/effects/enc2.png",
        flags: {
          wfrp4e: {
            "effectTrigger": "prePrepareData",
            "effectApplication": "actor",
            "script": `
                        args.actor.characteristics.ag.modifier -= 20;
                        if (args.actor.details.move.value > 2)
                        {
                            args.actor.details.move.value -= 2;
                            if (args.actor.details.move.value < 2)
                                args.actor.details.move.value = 2
                        }
                        `
          }
        }
      },
      "enc3": {
        label: game.i18n.localize("EFFECT.Encumbrance") + " 3",
        icon: "systems/wfrp4e/icons/effects/enc3.png",
        flags: {
          wfrp4e: {
            "effectTrigger": "prePrepareData",
            "effectApplication": "actor",
            "script": `
                        args.actor.details.move.value = 0;`
          }
        }
      },
      "cold1": {
        label: game.i18n.localize("EFFECT.ColdExposure") + " 1",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "cold2": {
        label: game.i18n.localize("EFFECT.ColdExposure") + " 2",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.s.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.i.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.fel.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.s.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "cold3": {
        label: game.i18n.localize("EFFECT.ColdExposure") + " 3",
        icon: "",
        flags: {
          wfrp4e: {
            "effectTrigger": "invoke",
            "effectApplication": "actor",
            "script": `
                        let tb = this.actor.characteristics.t.bonus
                        let damage = (await new Roll("1d10").roll()).total
                        damage -= tb
                        if (damage <= 0) damage = 1
                        if (this.actor.status.wounds.value <= damage)
                        {
                            this.actor.addCondition("unconscious")
                        }
                        this.actor.modifyWounds(-damage)
                    ui.notifications.notify(game.i18n.format("TookDamage", { damage: damage }))
                    `
          }
        }
      },
      "heat1": {
        label: game.i18n.localize("EFFECT.HeatExposure") + " 1",
        icon: "",
        changes: [
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "heat2": {
        label: game.i18n.localize("EFFECT.HeatExposure") + " 2",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.s.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.i.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.fel.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.s.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "heat3": {
        label: game.i18n.localize("EFFECT.HeatExposure") + " 3",
        icon: "",
        flags: {
          wfrp4e: {
            "effectTrigger": "invoke",
            "effectApplication": "actor",
            "script": `
                        let tb = this.actor.characteristics.t.bonus
                        let damage = (await new Roll("1d10").roll()).total
                        damage -= tb
                        if (damage <= 0) damage = 1
                        this.actor.modifyWounds(-damage)
                    ui.notifications.notify(game.i18n.format("TookDamage", { damage: damage }))
                    `
          }
        }
      },
      "thirst1": {
        label: game.i18n.localize("EFFECT.Thirst") + " 1",
        icon: "",
        changes: [
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.fel.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "thirst2": {
        label: game.i18n.localize("EFFECT.Thirst") + " 2+",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.s.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.i.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.fel.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.s.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "invoke",
            "effectApplication": "actor",
            "script": `
                    let tb = this.actor.characteristics.t.bonus
                    let damage = (await new Roll("1d10").roll()).total
                    damage -= tb
                    if (damage <= 0) damage = 1
                    this.actor.modifyWounds(-damage)
                    ui.notifications.notify(game.i18n.format("TookDamage", { damage: damage }))
                `
          }
        }
      },
      "starvation1": {
        label: game.i18n.localize("EFFECT.Starvation") + " 1",
        icon: "",
        changes: [
          { key: "system.characteristics.s.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.s.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "",
            "effectApplication": "actor",
            "script": ``
          }
        }
      },
      "starvation2": {
        label: game.i18n.localize("EFFECT.Starvation") + " 2",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.s.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.i.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.wp.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.fel.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.t.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.s.calculationBonusModifier", mode: 2, value: 1 },
          { key: "system.characteristics.wp.calculationBonusModifier", mode: 2, value: 1 }
        ],
        flags: {
          wfrp4e: {
            "effectTrigger": "invoke",
            "effectApplication": "actor",
            "script": `
                    let tb = this.actor.characteristics.t.bonus
                    let damage = (await new Roll("1d10").roll()).total
                    damage -= tb
                    if (damage <= 0) damage = 1
                    this.actor.modifyWounds(-damage)
                    ui.notifications.notify(game.i18n.format("TookDamage", { damage: damage }))
                `
          }
        }
      },
      "infighting": {
        label: game.i18n.localize("EFFECT.Infighting"),
        icon: "modules/wfrp4e-core/icons/talents/in-fighter.png",
        flags: {
          wfrp4e: {
            "effectTrigger": "prePrepareItem",
            "effectApplication": "actor",
            "script": `
                        if (args.item.type == "weapon" && args.item.isEquipped)
                        {
                            let weaponLength = args.item.reachNum
                            if (weaponLength > 3)
                            {
                                let improv = duplicate(game.wfrp4e.config.systemItems.improv)
                                improv.system.twohanded.value = args.item.twohanded.value
                                improv.system.offhand.value = args.item.offhand.value
                                improv.name = args.item.name + " (" + game.i18n.localize("EFFECT.Infighting") + ")"
                                mergeObject(args.item.system, improv.system, {overwrite : true})
                                args.item.system.qualities = improv.system.qualities
                                args.item.system.flaws = improv.system.flaws
                                args.item.name = improv.name
                                args.item.system.infighting = true;
                            }
                        }
                    `
          }
        }
      },
      "defensive": {
        label: game.i18n.localize("EFFECT.OnDefensive"),
        icon: "",
        flags: {
          wfrp4e: {
            "effectTrigger": "prefillDialog",
            "effectApplication": "actor",
            "script": `
                        let skillName = this.effect.label.substring(this.effect.label.indexOf("[") + 1, this.effect.label.indexOf("]"))
                        if (!this.actor.isOpposing)
                        return
                        if ((args.type == "skill" && args.item.name == skillName) ||
                            (args.type == "weapon" && args.item.skillToUse.name == skillName) ||
                            (args.type == "cast" && skillName == (game.i18n.localize("NAME.Language") + " (" + game.i18n.localize("SPEC.Magick") + ")")) ||
                            (args.type == "prayer" && skillName == game.i18n.localize("NAME.Pray")) || 
                            (args.type == "trait" && args.item.rollable.skill == skillName))
                            args.prefillModifiers.modifier += 20`
          }
        }
      },
      "dualwielder": {
        label: game.i18n.localize("EFFECT.DualWielder"),
        icon: "modules/wfrp4e-core/icons/talents/dual-wielder.png",
        flags: {
          wfrp4e: {
            "effectTrigger": "prefillDialog",
            "effectApplication": "actor",
            "script": `
                        if (this.actor.isOpposing)
                            args.prefillModifiers.modifier -= 10`
          }
        }
      },
      "consumealcohol1": {
        label: game.i18n.localize("EFFECT.ConsumeAlcohol") + " 1",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -10 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -10 }
        ]
      },
      "consumealcohol2": {
        label: game.i18n.localize("EFFECT.ConsumeAlcohol") + " 2",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -20 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -20 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -20 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -20 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -20 }
        ]
      },
      "consumealcohol3": {
        label: game.i18n.localize("EFFECT.ConsumeAlcohol") + " 3",
        icon: "",
        changes: [
          { key: "system.characteristics.bs.modifier", mode: 2, value: -30 },
          { key: "system.characteristics.ag.modifier", mode: 2, value: -30 },
          { key: "system.characteristics.ws.modifier", mode: 2, value: -30 },
          { key: "system.characteristics.int.modifier", mode: 2, value: -30 },
          { key: "system.characteristics.dex.modifier", mode: 2, value: -30 }
        ]
      },
      "stinkingdrunk1": {
        label: game.i18n.localize("EFFECT.MarienburghersCourage"),
        icon: "",
        flags: {
          wfrp4e: {
            "effectTrigger": "prefillDialog",
            "effectApplication": "actor",
            "script": `
                        let skillName = game.i18n.localize("NAME.Cool")
                        if (args.type=="skill" && args.item.name==skillName)
                            args.prefillModifiers.modifier += 20`
          }
        }
      }
    });
    this.statusEffects = [
      {
        icon: "systems/wfrp4e/icons/conditions/bleeding.png",
        id: "bleeding",
        label: "WFRP4E.ConditionName.Bleeding",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/poisoned.png",
        id: "poisoned",
        label: "WFRP4E.ConditionName.Poisoned",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "effectTrigger": "prefillDialog",
            "script": "args.prefillModifiers.modifier -= 10 * this.effect.conditionValue",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/ablaze.png",
        id: "ablaze",
        label: "WFRP4E.ConditionName.Ablaze",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/deafened.png",
        id: "deafened",
        label: "WFRP4E.ConditionName.Deafened",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "effectTrigger": "dialogChoice",
            "effectData": {
              "description": game.i18n.localize("EFFECT.TestsRelatedToHearing"),
              "modifier": "-10 * this.flags.wfrp4e.value"
            },
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/stunned.png",
        id: "stunned",
        label: "WFRP4E.ConditionName.Stunned",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "effectTrigger": "prefillDialog",
            "script": "args.prefillModifiers.modifier -= 10 * this.effect.conditionValue",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/entangled.png",
        id: "entangled",
        label: "WFRP4E.ConditionName.Entangled",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "effectTrigger": "dialogChoice",
            "effectData": {
              "description": game.i18n.localize("EFFECT.TestsRelatedToMovementOfAnyKind"),
              "modifier": "-10 * this.flags.wfrp4e.value"
            },
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/fatigued.png",
        id: "fatigued",
        label: "WFRP4E.ConditionName.Fatigued",
        flags: {
          wfrp4e: {
            "effectTrigger": "prefillDialog",
            "script": "args.prefillModifiers.modifier -= 10 * this.effect.conditionValue",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/blinded.png",
        id: "blinded",
        label: "WFRP4E.ConditionName.Blinded",
        flags: {
          wfrp4e: {
            "trigger": "endRound",
            "effectTrigger": "dialogChoice",
            "effectData": {
              "description": game.i18n.localize("EFFECT.TestsRelatedToSight"),
              "modifier": "-10 * this.flags.wfrp4e.value"
            },
            "value": 1,
            "secondaryEffect": {
              "effectTrigger": "targetPrefillDialog",
              "script": "if (args.item && args.item.attackType=='melee') args.prefillModifiers.modifier += 10 * this.effect.conditionValue"
            }
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/broken.png",
        id: "broken",
        label: "WFRP4E.ConditionName.Broken",
        flags: {
          wfrp4e: {
            "effectTrigger": "prefillDialog",
            "script": "args.prefillModifiers.modifier -= 10 * this.effect.conditionValue",
            "value": 1
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/prone.png",
        id: "prone",
        label: "WFRP4E.ConditionName.Prone",
        flags: {
          wfrp4e: {
            "effectTrigger": "dialogChoice",
            "effectData": {
              "description": game.i18n.localize("EFFECT.TestsRelatedToMovementOfAnyKind"),
              "modifier": "-20"
            },
            "value": null,
            "secondaryEffect": {
              "effectTrigger": "targetPrefillDialog",
              "script": "if (args.type == 'weapon' && args.item.attackType=='melee') args.prefillModifiers.modifier += 20"
            }
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/fear.png",
        id: "fear",
        label: "WFRP4E.ConditionName.Fear",
        flags: {
          wfrp4e: {
            "effectTrigger": "dialogChoice",
            "effectData": {
              "description": game.i18n.localize("EFFECT.TestsToAffect"),
              "slBonus": "-1"
            },
            "script": `
                        if (this.flags.wfrp4e.fearName)
                            this.flags.wfrp4e.effectData.description += " " + this.flags.wfrp4e.fearName
                        else
                            this.flags.wfrp4e.effectData.description += " " + game.i18n.localize("EFFECT.TheSourceOfFear")
                    `,
            "value": null
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/surprised.png",
        id: "surprised",
        label: "WFRP4E.ConditionName.Surprised",
        flags: {
          wfrp4e: {
            "value": null,
            "secondaryEffect": {
              "effectTrigger": "targetPrefillDialog",
              "script": "if (args.type == 'weapon' && args.item.attackType=='melee') args.prefillModifiers.modifier += 20"
            }
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/unconscious.png",
        id: "unconscious",
        label: "WFRP4E.ConditionName.Unconscious",
        flags: {
          wfrp4e: {
            "value": null
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/conditions/grappling.png",
        id: "grappling",
        label: "WFRP4E.ConditionName.Grappling",
        flags: {
          wfrp4e: {
            "value": null
          }
        }
      },
      {
        icon: "systems/wfrp4e/icons/defeated.png",
        id: "dead",
        label: "WFRP4E.ConditionName.Dead",
        flags: {
          wfrp4e: {
            "value": null
          }
        }
      }
    ];
  };
  WFRP4E.conditionScripts = {
    "ablaze": async function(actor) {
      let effect = actor.hasCondition("ablaze");
      let value = effect.conditionValue;
      let leastProtectedLoc;
      let leastProtectedValue = 999;
      for (let loc in actor.status.armour) {
        if (actor.status.armour[loc].value != void 0 && actor.status.armour[loc].value < leastProtectedValue) {
          leastProtectedLoc = loc;
          leastProtectedValue = actor.status.armour[loc].value;
        }
      }
      let rollString = `1d10 + ${value - 1}`;
      let roll = await new Roll(`${rollString} - ${leastProtectedValue || 0}`).roll();
      let msg = `<h2>${game.i18n.localize("WFRP4E.ConditionName.Ablaze")}</h2><b>${game.i18n.localize("Formula")}</b>: ${rollString}<br><b>${game.i18n.localize("Roll")}</b>: ${roll.terms.map((i) => i.total).splice(0, 3).join(" ")}`;
      actor.runEffects("preApplyCondition", { effect, data: { msg, roll, rollString } });
      value = effect.conditionValue;
      let damageMsg = (`<br>` + await actor.applyBasicDamage(roll.total, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_AP, suppressMsg: true })).split("");
      damageMsg.splice(damageMsg.length - 1, 1);
      msg += damageMsg.join("").concat(` + ${leastProtectedValue} ${game.i18n.localize("AP")})`);
      let messageData = game.wfrp4e.utility.chatDataSetup(msg);
      messageData.speaker = { alias: actor.prototypeToken.name };
      actor.runEffects("applyCondition", { effect, data: { messageData } });
      return messageData;
    },
    "poisoned": async function(actor) {
      let effect = actor.hasCondition("poisoned");
      let msg = `<h2>${game.i18n.localize("WFRP4E.ConditionName.Poisoned")}</h2>`;
      actor.runEffects("preApplyCondition", { effect, data: { msg } });
      let value = effect.conditionValue;
      msg += await actor.applyBasicDamage(value, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_ALL, suppressMsg: true });
      let messageData = game.wfrp4e.utility.chatDataSetup(msg);
      messageData.speaker = { alias: actor.prototypeToken.name };
      actor.runEffects("applyCondition", { effect, data: { messageData } });
      return messageData;
    },
    "bleeding": async function(actor) {
      let effect = actor.hasCondition("bleeding");
      let bleedingAmt;
      let bleedingRoll;
      let msg = `<h2>${game.i18n.localize("WFRP4E.ConditionName.Bleeding")}</h2>`;
      actor.runEffects("preApplyCondition", { effect, data: { msg } });
      let value = effect.conditionValue;
      msg += await actor.applyBasicDamage(value, { damageType: game.wfrp4e.config.DAMAGE_TYPE.IGNORE_ALL, minimumOne: false, suppressMsg: true });
      if (actor.status.wounds.value == 0 && !actor.hasCondition("unconscious")) {
        await actor.addCondition("unconscious");
        msg += `<br>${game.i18n.format("BleedUnc", { name: actor.prototypeToken.name })}`;
      }
      if (actor.hasCondition("unconscious")) {
        bleedingAmt = value;
        bleedingRoll = (await new Roll("1d100").roll()).total;
        if (bleedingRoll <= bleedingAmt * 10) {
          msg += `<br>${game.i18n.format("BleedFail", { name: actor.prototypeToken.name })} (${game.i18n.localize("Rolled")} ${bleedingRoll})`;
          actor.addCondition("dead");
        } else if (bleedingRoll % 11 == 0) {
          msg += `<br>${game.i18n.format("BleedCrit", { name: actor.prototypeToken.name })} (${game.i18n.localize("Rolled")} ${bleedingRoll})`;
          actor.removeCondition("bleeding");
        } else {
          msg += `<br>${game.i18n.localize("BleedRoll")}: ${bleedingRoll}`;
        }
      }
      let messageData = game.wfrp4e.utility.chatDataSetup(msg);
      messageData.speaker = { alias: actor.prototypeToken.name };
      actor.runEffects("applyCondition", { effect, data: { messageData, bleedingRoll } });
      return messageData;
    }
  };
  WFRP4E.effectTextStyle = CONFIG.canvasTextStyle.clone();
  WFRP4E.effectTextStyle.fontSize = "30";
  WFRP4E.effectTextStyle.fontFamily = "CaslonAntique";
  WFRP4E.effectApplication = {
    "actor": "WFRP4E.effectApplication.actor",
    "equipped": "WFRP4E.effectApplication.equipped",
    "apply": "WFRP4E.effectApplication.apply",
    "damage": "WFRP4E.effectApplication.damage"
  };
  WFRP4E.applyScope = {
    "actor": "WFRP4E.applyScope.actor",
    "item": "WFRP4E.applyScope.item"
  };
  WFRP4E.effectTriggers = {
    "invoke": "Manually Invoked",
    "oneTime": "Immediate",
    "dialogChoice": "Dialog Choice",
    "prefillDialog": "Prefill Dialog",
    "prePrepareData": "Pre-Prepare Data",
    "prePrepareItems": "Pre-Prepare Actor Items",
    "prepareData": "Prepare Data",
    "preWoundCalc": "Pre-Wound Calculation",
    "woundCalc": "Wound Calculation",
    "preApplyDamage": "Pre-Apply Damage",
    "applyDamage": "Apply Damage",
    "preTakeDamage": "Pre-Take Damage",
    "takeDamage": "Take Damage",
    "preApplyCondition": "Pre-Apply Condition",
    "applyCondition": "Apply Condition",
    "prePrepareItem": "Pre-Prepare Item",
    "prepareItem": "Prepare Item",
    "preRollTest": "Pre-Roll Test",
    "preRollWeaponTest": "Pre-Roll Weapon Test",
    "preRollCastTest": "Pre-Roll Casting Test",
    "preChannellingTest": "Pre-Roll Channelling Test",
    "preRollPrayerTest": "Pre-Roll Prayer Test",
    "preRollTraitTest": "Pre-Roll Trait Test",
    "rollTest": "Roll Test",
    "rollIncomeTest": "Roll Income Test",
    "rollWeaponTest": "Roll Weapon Test",
    "rollCastTest": "Roll Casting Test",
    "rollChannellingTest": "Roll Channelling Test",
    "rollPrayerTest": "Roll Prayer Test",
    "rollTraitTest": "Roll Trait Test",
    "preOpposedAttacker": "Pre-Opposed Attacker",
    "preOpposedDefender": "Pre-Opposed Defender",
    "opposedAttacker": "Opposed Attacker",
    "opposedDefender": "Opposed Defender",
    "calculateOpposedDamage": "Calculate Opposed Damage",
    "targetPrefillDialog": "Prefill Targeter's Dialog",
    "getInitiativeFormula": "Get Initiative",
    "endTurn": "End Turn",
    "startTurn": "Start Turn",
    "endRound": "End Round",
    "endCombat": "End Combat"
  };
  WFRP4E.effectPlaceholder = {
    "invoke": `This effect is only applied when the Invoke button is pressed.
    args:

    none`,
    "oneTime": `This effect happens once, immediately when applied.
    args:

    actor : actor who owns the effect
    `,
    "prefillDialog": `This effect is applied before rendering the roll dialog, and is meant to change the values prefilled in the bonus section
    args:

    prefillModifiers : {modifier, difficulty, slBonus, successBonus}
    type: string, 'weapon', 'skill' 'characteristic', etc.
    item: the item used of the aforementioned type
    options: other details about the test (options.rest or options.mutate for example)
    
    Example: 
    if (args.type == "skill" && args.item.name == "Athletics") args.prefillModifiers.modifier += 10`,
    "prePrepareData": `This effect is applied before any actor data is calculated.
    args:

    actor : actor who owns the effect
    `,
    "prePrepareItems": `This effect is applied before items are sorted and calculated

    actor : actor who owns the effect
    `,
    "prepareData": `This effect is applied after actor data is calculated and processed.

    args:

    actor : actor who owns the effect
    `,
    "preWoundCalc": `This effect is applied right before wound calculation, ideal for swapping out characteristics or adding multipiliers

    actor : actor who owns the effect
    sb : Strength Bonus
    tb : Toughness Bonus
    wpb : Willpower Bonus
    multiplier : {
        sb : SB Multiplier
        tb : TB Multiplier
        wpb : WPB Modifier
    }

    e.g. for Hardy: "args.multiplier.tb += 1"
    `,
    "woundCalc": `This effect happens after wound calculation, ideal for multiplying the result.

    args:

    actor : actor who owns the effect
    wounds : wounds calculated

    e.g. for Swarm: "wounds *= 5"
    `,
    "preApplyDamage": `This effect happens before applying damage in an opposed test

    args:

    actor : actor who is taking damage
    attacker : actor who is attacking
    opposedTest : object containing opposed test data
    damageType : damage type selected (ignore TB, AP, etc.)
    `,
    "applyDamage": `This effect happens after damage in an opposed test is calculated, but before actor data is updated.

    args:

    actor : actor who is taking damage
    attacker : actor who is attacking
    opposedTest : object containing opposed test data
    damageType : damage type selected (ignore TB, AP, etc.)
    totalWoundLoss : Wound loss after mitigations
    AP : data about the AP used
    updateMsg : starting string for damage update message
    messageElements : arary of strings used to show how damage mitigation was calculated
    `,
    "preTakeDamage": `This effect happens before taking damage in an opposed test

    args:

    actor : actor who is taking damage
    attacker : actor who is attacking
    opposedTest : object containing opposed test data
    damageType : damage type selected (ignore TB, AP, etc.)
    `,
    "takeDamage": `This effect happens after damage in an opposed test is calculated, but before actor data is updated.

    args:

    actor : actor who is taking damage
    attacker : actor who is attacking
    opposedTest : object containing opposed test data
    damageType : damage type selected (ignore TB, AP, etc.)
    totalWoundLoss : Wound loss after mitigations
    AP : data about the AP used
    updateMsg : starting string for damage update message
    messageElements : arary of strings used to show how damage mitigation was calculated
    `,
    "preApplyCondition": `This effect happens before effects of a condition are applied.

    args:

    effect : condition being applied
    data : {
        msg : Chat message about the application of the condition
        <other data, possibly condition specific>
    }
    `,
    "applyCondition": `This effect happens after effects of a condition are applied.

    args:

    effect : condition being applied
    data : {
        messageData : Chat message about the application of the condition
        <other data, possibly condition specific>
    }
    `,
    "prePrepareItem": `This effect is applied before an item is processed with actor data.

    args:

    item : item being processed
    `,
    "prepareItem": `This effect is applied after an item is processed with actor data.

    args:

    item : item processed
    `,
    "preRollTest": `This effect is applied before a test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "preRollWeaponTest": `This effect is applied before a weapon test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "preRollCastTest": `This effect is applied before a casting test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "preChannellingTest": `This effect is applied before a channelling test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "preRollPrayerTest": `This effect is applied before a prayer test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "preRollTraitTest": `This effect is applied before a trait test is calculated.

    args:

    testData: All the data needed to evaluate test results
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollTest": `This effect is applied after a test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollIncomeTest": `This effect is applied after an income test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollWeaponTest": `This effect is applied after a weapon test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollCastTest": `This effect is applied after a casting test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollChannellingTest": `This effect is applied after a channelling test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollPrayerTest": `This effect is applied after a prayer test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "rollTraitTest": `This effect is applied after a trait test is calculated.

    args:

    test: object containing test and result information
    cardOptions: Data for the card display, title, template, etc
    `,
    "preOpposedAttacker": `This effect is applied before an opposed test result begins calculation, as the attacker.

    args:

    attackerTest: test object of the attacker
    defenderTest: test object of the defender
    opposedTest: opposedTest object, before calculation
    `,
    "preOpposedDefender": `This effect is applied before an opposed test result begins calculation, as the defender.

    args:

    attackerTest: test object of the attacker
    defenderTest: test object of the defender
    opposedTest: opposedTest object, before calculation
    `,
    "opposedAttacker": `This effect is applied after an opposed test result begins calculation, as the attacker.

    args:

    attackerTest: test object of the attacker
    defenderTest: test object of the defender
    opposedTest: opposedTest object, after calculation
    `,
    "opposedDefender": `This effect is applied before an opposed test result begins calculation, as the defender.

    args:

    attackerTest: test object of the attacker
    defenderTest: test object of the defender
    opposedTest: opposedTest object, after calculation
    `,
    "calculateOpposedDamage": `This effect is applied during an opposed test damage calculation. This effect runs on the attacking actor

    args:

    damage : initial damage calculation before multipliers
    damageMultiplier : multiplier calculated based on size difference
    sizeDiff : numeric difference in sized, will then be used to add damaging/impact
    opposedTest : opposedTest object,
    addDamaging : whether to add the Damaging quality 
    addImpact : whether to add the Impact quality
    `,
    "getInitiativeFormula": `This effect runs when determining actor's initiative

    args:

    initiative: Calculated initiative value
    `,
    "targetPrefillDialog": `This effect is applied to another actor whenever they target this actor, and is meant to change the values prefilled in the bonus section
    args:

    prefillModifiers : {modifier, difficulty, slBonus, successBonus}
    type: string, 'weapon', 'skill' 'characteristic', etc.
    item: the item used of the aforementioned type
    options: other details about the test (options.rest or options.mutate for example)
    
    Example: 
    if (args.type == "skill" && args.item.name == "Athletics") args.prefillModifiers.modifier += 10`,
    "endTurn": `This effect runs at the end of an actor's turn

    args:

    combat: current combat
    `,
    "startTurn": `This effect runs at the start of an actor's turn

    args:

    combat: current combat
    `,
    "endRound": `This effect runs at the end of a round

    args:

    combat: current combat
    `,
    "endCombat": `This effect runs when combat has ended

    args:

    combat: current combat
    `,
    "this": `
    
    All effects have access to: 
        this.actor : actor running the effect
        this.effect : effect being executed
        this.item : item that has the effect, if effect comes from an item`
  };
  var config_wfrp4e_default = WFRP4E;

  // modules/apps/actor-settings.js
  var ActorSettings = class extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "actor-settings";
      options.template = "systems/wfrp4e/templates/apps/actor-settings.html";
      options.height = "auto";
      options.width = 400;
      options.minimizable = true;
      options.title = "Actor Settings";
      return options;
    }
    getData() {
      let data = super.getData();
      data.tables = game.wfrp4e.config.hitLocationTables;
      data.displays = {};
      if (this.object.type == "character") {
        data.displays.size = true;
        data.displays.movement = true;
        data.displays.wounds = true;
        data.displays.critwounds = true;
        data.displays.corruption = true;
        data.displays.encumbrance = true;
        data.displays.hitloc = true;
        data.displays.equipPoints = true;
      }
      if (this.object.type == "npc") {
        data.displays.size = true;
        data.displays.movement = true;
        data.displays.wounds = true;
        data.displays.critwounds = true;
        data.displays.encumbrance = true;
        data.displays.hitloc = true;
        data.displays.equipPoints = true;
      }
      if (this.object.type == "creature") {
        data.displays.size = true;
        data.displays.movement = true;
        data.displays.wounds = true;
        data.displays.critwounds = true;
        data.displays.encumbrance = true;
        data.displays.hitloc = true;
        data.displays.equipPoints = true;
      }
      if (this.object.type == "vehicle") {
        data.displays.vehicle = true;
        data.displays.critwounds = true;
        data.displays.hitloc = true;
      }
      return data;
    }
    async _updateObject(event2, formData) {
      this.object.update(formData);
    }
  };

  // modules/apps/active-effect.js
  var WFRPActiveEffectConfig = class extends ActiveEffectConfig {
    getData() {
      let data = super.getData();
      data.effectTriggers = game.wfrp4e.config.effectTriggers;
      let type = getProperty(data, "effect.flags.wfrp4e.effectTrigger");
      if (type && type != "dialogChoice") {
        data.showEditor = true;
        data.placeholder = game.wfrp4e.config.effectPlaceholder[type] + game.wfrp4e.config.effectPlaceholder.this;
      }
      data.effectApplication = duplicate(game.wfrp4e.config.effectApplication);
      if (this.object.parent.documentName == "Item") {
        if (this.object.parent.type == "weapon" || this.object.parent.type == "armour" || this.object.parent.type == "trapping" || this.object.parent.type == "ammo") {
          if (this.object.parent.type == "trapping" && this.object.parent.system.trappingType.value != "clothingAccessories")
            delete data.effectApplication.equipped;
        }
        if (this.object.parent.type == "spell" || this.object.parent.type == "prayer") {
          delete data.effectApplication.equipped;
          delete data.effectApplication.actor;
        }
        if (this.object.parent.type == "talent" || this.object.parent.type == "trait" || this.object.parent.type == "psychology" || this.object.parent.type == "disease" || this.object.parent.type == "injury" || this.object.parent.type == "critical") {
          if (this.object.parent.type != "trait")
            delete data.effectApplication.damage;
          delete data.effectApplication.equipped;
        }
        if (this.object.parent.type == "trapping" && (this.object.trigger == "invoke" || this.object.application == "apply")) {
          data.quantityOption = true;
        }
      } else {
        delete data.effectApplication.equipped;
        delete data.effectApplication.damage;
      }
      if (this.object.application == "damage") {
        data.effect.flags.wfrp4e.effectTrigger = "applyDamage";
        data.disableTrigger = true;
      }
      return data;
    }
    get template() {
      return "systems/wfrp4e/templates/apps/active-effect-config.html";
    }
    async _updateObject(event2, formData) {
      let keys = Object.keys(formData).filter((i) => i.includes(".key"));
      let values = [];
      for (let key of keys)
        values.push(formData[key]);
      values = values.filter((i) => !!i);
      let character = { data: game.system.model.Actor.character };
      let npc = { data: game.system.model.Actor.npc };
      let creature = { data: game.system.model.Actor.creature };
      let vehicle = { data: game.system.model.Actor.vehicle };
      for (let value of values) {
        let invalidProperty = true;
        if (hasProperty(character, value))
          invalidProperty = false;
        if (hasProperty(npc, value))
          invalidProperty = false;
        if (hasProperty(creature, value))
          invalidProperty = false;
        if (hasProperty(vehicle, value))
          invalidProperty = false;
        if (invalidProperty)
          return ui.notifications.error("Invalid key detected. Please ensure to input the correct key values to point to existing actor data. Ex. 'data.characteristics.ws.modifier'");
      }
      await super._updateObject(event2, formData);
    }
    activateListeners(html) {
      super.activateListeners(html);
      this.effectTriggerSelect = html.find(".effect-type").change((ev) => {
        this.effectApplicationSelect.value = "";
        this.submit({ preventClose: true });
      });
      this.effectApplicationSelect = html.find(".effect-application").change((ev) => {
        if (ev.target.value == "damage")
          this.effectTriggerSelect.value = "applyDamage";
        if (ev.target.value == "invoke")
          this.effectTriggerSelect.value = "";
        this.submit({ preventClose: true });
      });
    }
  };

  // modules/apps/career-selector.js
  var CareerSelector = class extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "career-selector";
      options.template = "systems/wfrp4e/templates/apps/career-selector.html";
      options.height = 800;
      options.width = 400;
      options.minimizable = true;
      options.title = "Career Selector";
      return options;
    }
    constructor(app) {
      super(app);
      this.careers = [];
      this.currentCareer = this.object.currentCareer;
      this.selectedCareer = -1;
    }
    async _render(...args) {
      await super._render(...args);
    }
    getData() {
      let data = super.getData();
      data.careerList = {};
      if (this.careers.length) {
        data.careerList = this.sortCareers();
      } else {
        this.loadCareers();
        data.loading = true;
      }
      return data;
    }
    async loadCareers() {
      this.careers = [];
      this.careers = await game.wfrp4e.utility.findAll("career");
      this.careers = this.careers.sort((a, b) => a.careergroup.value > b.careergroup.value ? 1 : -1);
      this.careers = this.careers.filter((i) => i.compendium && !i.compendium.private || i.permission > 2);
      this._render(true);
    }
    sortCareers() {
      let careerList = {
        inClass: {},
        outOfClass: {}
      };
      if (!this.careers.length)
        return careerList;
      this.careers.forEach((tier, i) => {
        try {
          let data = { link: tier.link, level: tier.level.value, img: tier.img, name: tier.name, index: i };
          let type = "outOfClass";
          if (this.currentCareer && this.currentCareer.class.value == tier.class.value)
            type = "inClass";
          if (careerList[type][tier.careergroup.value]?.length) {
            if (!careerList[type][tier.careergroup.value].find((i2) => i2.name == tier.name))
              careerList[type][tier.careergroup.value].push(data);
          } else
            careerList[type][tier.careergroup.value] = [data];
        } catch (e) {
          ui.notifications.error(`Error when displaying ${tier.name}: ${e}`);
        }
      });
      for (let career in careerList.inClass)
        careerList.inClass[career] = careerList.inClass[career].sort((a, b) => a.level > b.level ? 1 : -1);
      for (let career in careerList.outOfClass)
        careerList.outOfClass[career] = careerList.outOfClass[career].sort((a, b) => a.level > b.level ? 1 : -1);
      return careerList;
    }
    async _updateObject(event2, formData) {
      await this.object.createEmbeddedDocuments("Item", [this.selectedCareer.toObject()]);
      let experience = duplicate(this.object.details.experience);
      experience.spent += parseInt(formData.exp);
      experience.log = this.object._addToExpLog(formData.exp, `${game.i18n.format("LOG.CareerChange", { career: this.selectedCareer.name })}`, experience.spent, void 0);
      this.object.update({ "system.details.experience": experience });
    }
    calculateMoveExp() {
      let exp = 0, reasons = [];
      if (!this.selectedCareer)
        return { exp };
      if (this.currentCareer) {
        exp += this.currentCareer.complete.value ? 100 : 200;
        reasons.push(this.currentCareer.complete.value ? game.i18n.localize("CAREER.LeaveComplete") : game.i18n.localize("CAREER.LeaveIncomplete"));
        if (this.selectedCareer.class.value != this.currentCareer.class.value) {
          exp += 100;
          reasons.push(game.i18n.localize("CAREER.DifferentClass"));
        }
      } else {
        exp += 100;
      }
      return { exp, tooltip: reasons.join(", ") };
    }
    activateListeners(html) {
      super.activateListeners(html);
      let input = html.find("input")[0];
      html.find(".career-tier").mousedown((ev) => {
        if (ev.button == 0) {
          html.find(".career-tier.active").each(function() {
            $(this).removeClass("active");
          });
          $(ev.currentTarget).toggleClass("active");
          this.selectedCareer = this.careers[Number($(ev.currentTarget).attr("data-index"))];
          let { exp, tooltip } = this.calculateMoveExp();
          input.value = exp;
          input.setAttribute("title", tooltip);
        } else if (ev.button == 2) {
          this.careers[Number($(ev.currentTarget).attr("data-index"))].sheet.render(true);
        }
      });
    }
  };

  // modules/system/tag-manager.js
  var TagManager = class {
    createTags() {
      this.tags = {};
      Array.from(game.packs.keys()).forEach((packKey) => {
        this.tags[packKey] = this.findTagsFromIndex(game.packs.get(packKey).index);
      });
    }
    findTagsFromIndex(index) {
      let tags = [];
      index.forEach((i) => {
        if (!tags.includes(i.type))
          tags.push(i.type);
      });
      return tags;
    }
    getPacksWithTag(tags) {
      if (!tags || tags.length == 0)
        return Object.keys(this.tags).map((k) => game.packs.get(k));
      if (!Array.isArray(tags))
        tags = [tags];
      let keys = [];
      for (let key in this.tags)
        if (this.tags[key].some((t) => tags.includes(t)))
          keys.push(key);
      return keys.map((k) => game.packs.get(k));
    }
  };

  // modules/apps/item-properties.js
  var ItemProperties = class extends FormApplication {
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.id = "item-properties";
      options.template = "systems/wfrp4e/templates/apps/item-properties.html";
      options.height = "auto";
      options.width = 400;
      options.minimizable = true;
      options.title = "Item Properties";
      return options;
    }
    constructor(...args) {
      super(...args);
      if (this.object.type == "weapon" || this.object.type == "ammunition") {
        this.qualities = foundry.utils.deepClone(game.wfrp4e.config.weaponQualities);
        this.flaws = foundry.utils.deepClone(game.wfrp4e.config.weaponFlaws);
      } else if (this.object.type == "armour") {
        this.qualities = foundry.utils.deepClone(game.wfrp4e.config.armorQualities);
        this.flaws = foundry.utils.deepClone(game.wfrp4e.config.armorFlaws);
      } else if (this.object.type == "trapping") {
        this.qualities = {};
        this.flaws = {};
      }
      mergeObject(this.qualities, game.wfrp4e.config.itemQualities);
      mergeObject(this.flaws, game.wfrp4e.config.itemFlaws);
    }
    getData() {
      let data = super.getData();
      data.qualities = Object.keys(this.qualities).map((i) => {
        return {
          name: this.qualities[i],
          hasValue: game.wfrp4e.config.propertyHasValue[i],
          key: i,
          existing: this.object.originalProperties.qualities[i]
        };
      });
      data.flaws = Object.keys(this.flaws).map((i) => {
        return {
          name: this.flaws[i],
          hasValue: game.wfrp4e.config.propertyHasValue[i],
          key: i,
          existing: this.object.originalProperties.flaws[i]
        };
      });
      data.customQualities = this.object.qualities.value.filter((i) => i.custom).map((i) => `${i.name} ${i.value ? "(" + i.value + ")" : ""}: ${i.description}`).join(" | ");
      data.customFlaws = this.object.flaws.value.filter((i) => i.custom).map((i) => `${i.name} ${i.value ? "(" + i.value + ")" : ""}: ${i.description}`).join(" | ");
      return data;
    }
    async _updateObject(event2, formData) {
      let qualities = [];
      let flaws = [];
      for (let prop in formData) {
        if (prop == "custom-quality")
          qualities = qualities.concat(this.parseCustomProperty(formData[prop]));
        else if (prop == "custom-flaw")
          flaws = flaws.concat(this.parseCustomProperty(formData[prop]));
        if (formData[prop] && !prop.includes("-value")) {
          let property = {
            name: prop,
            value: null
          };
          if (formData[`${prop}-value`]) {
            let value = formData[`${prop}-value`];
            if (Number.isNumeric(value))
              value = parseInt(value);
            property.value = value;
          }
          if (this.qualities[prop])
            qualities.push(property);
          else if (this.flaws[prop])
            flaws.push(property);
        }
      }
      WFRP_Utility.log("Updating Qualities/Flaws", false, formData, qualities, flaws);
      this.object.update({ "system.qualities.value": qualities, "system.flaws.value": flaws });
    }
    parseCustomProperty(string) {
      let regex = /(.+?)(\((.+?)\))*\s*:(.+?)(\||$)/gm;
      let matches = string.matchAll(regex);
      let traits = [];
      for (let match of matches) {
        traits.push({
          key: match[1].trim().slugify(),
          custom: true,
          value: match[3],
          name: match[1].trim(),
          display: (match[1].trim() + ` ${match[3] ? match[3] : ""}`).trim(),
          description: match[4].trim()
        });
      }
      return traits;
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".property-input").change((ev) => {
        let property = ev.target.classList[1];
        let checked = ev.target.value ? true : false;
        let element = $(ev.currentTarget).parents("form").find(`[name=${property}]`)[0];
        if (element)
          element.checked = checked;
      });
    }
  };

  // modules/system/rolls/skill-test.js
  var SkillTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.data.preData.options.characteristicToUse = data.characteristicToUse;
      this.data.preData.skillName = data.skillName;
      this.computeTargetNumber();
    }
    computeTargetNumber() {
      if (this.preData.item == "unknown" && !this.context.unknownSkill)
        return 0;
      try {
        if (this.context.unknownSkill) {
          this.result.target = this.actor.characteristics[this.context.unknownSkill.system.characteristic.value].value;
        } else {
          if (this.preData.options.characteristicToUse && this.preData.options.characteristicToUse != this.item.characteristic.key)
            this.result.target = this.actor.characteristics[this.preData.options.characteristicToUse].value + this.item.advances.value;
          else
            this.result.target = this.item.total.value;
        }
      } catch {
        this.result.target = this.item.total.value;
      }
      super.computeTargetNumber();
    }
    async roll() {
      if (this.preData.item == "unknown") {
        let skill = await WFRP_Utility.findSkill(this.preData.skillName);
        if (skill) {
          this.context.unknownSkill = skill.toObject();
          this.computeTargetNumber();
        } else {
          throw new Error(game.i18n.localize("ERROR.Found", { name: this.skill }));
        }
      }
      return super.roll();
    }
    get skill() {
      return this.item;
    }
    get item() {
      return this.unknownSkill ? this.unknownSkill : super.item || {};
    }
    get characteristicKey() {
      if (this.preData.options.characteristicToUse)
        return this.preData.options.characteristicToUse;
      else
        return this.item.characteristic.key;
    }
  };

  // modules/system/rolls/weapon-test.js
  var WeaponTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.preData.ammoId = data.ammo?.id;
      this.preData.skillSelected = data.skillSelected || {};
      this.preData.charging = data.charging || false;
      this.preData.champion = data.champion || false;
      this.preData.riposte = data.riposte || false;
      this.preData.infighter = data.infighter || false;
      this.preData.resolute = data.resolute || 0;
      this.preData.dualWielding = data.dualWielding || false;
      this.computeTargetNumber();
      this.preData.skillSelected = data.skillSelected instanceof Item ? data.skillSelected.name : data.skillSelected;
    }
    computeTargetNumber() {
      try {
        if (this.preData.skillSelected.char)
          this.result.target = this.actor.characteristics[this.preData.skillSelected.key].value;
        else if (this.preData.skillSelected.name == this.item.skillToUse.name)
          this.result.target = this.item.skillToUse.total.value;
        else if (typeof this.preData.skillSelected == "string") {
          let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
          if (skill)
            this.result.target = skill.total.value;
        } else
          this.result.target = this.item.skillToUse.total.value;
      } catch {
        this.result.target = this.item.skillToUse.total.value;
      }
      super.computeTargetNumber();
    }
    runPreEffects() {
      super.runPreEffects();
      this.actor.runEffects("preRollWeaponTest", { test: this, cardOptions: this.context.cardOptions });
    }
    runPostEffects() {
      super.runPostEffects();
      this.actor.runEffects("rollWeaponTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollWeaponTest", this, this.context.cardOptions);
    }
    async roll() {
      if (this.options.offhand && this.options.offhandReverse)
        this.preData.roll = this.options.offhandReverse;
      await super.roll();
    }
    async computeResult() {
      await super.computeResult();
      let weapon2 = this.item;
      if (this.result.outcome == "failure") {
        if (this.result.roll % 11 == 0 || this.result.roll == 100 || weapon2.properties.flaws.dangerous && this.result.roll.toString().includes("9")) {
          this.result.fumble = game.i18n.localize("Fumble");
          if ((weapon2.weaponGroup.value == "blackpowder" || weapon2.weaponGroup.value == "engineering" || weapon2.weaponGroup.value == "explosives") && this.result.roll % 2 == 0) {
            this.result.misfire = game.i18n.localize("Misfire");
            this.result.misfireDamage = (0, eval)(parseInt(this.result.roll.toString().split("").pop()) + weapon2.Damage);
          }
        }
        if (weapon2.properties.flaws.unreliable)
          this.result.SL--;
        if (weapon2.properties.qualities.practical)
          this.result.SL++;
        if (weapon2.weaponGroup.value == "throwing")
          this.result.scatter = game.i18n.localize("Scatter");
      } else {
        if (weapon2.properties.qualities.blast)
          this.result.other.push(`<a class='aoe-template'><i class="fas fa-ruler-combined"></i>${weapon2.properties.qualities.blast.value} yard Blast</a>`);
        if (this.result.roll % 11 == 0)
          this.result.critical = game.i18n.localize("Critical");
        if (weapon2.properties.qualities.impale && this.result.roll % 10 == 0)
          this.result.critical = game.i18n.localize("Critical");
      }
      await this._calculateDamage();
      return this.result;
    }
    async _calculateDamage() {
      let weapon2 = this.weapon;
      this.result.additionalDamage = this.preData.additionalDamage || 0;
      let damageToUse = this.result.SL;
      if (this.useMount && this.actor.mount.characteristics.s.bonus > this.actor.characteristics.s.bonus)
        this.result.damage = (0, eval)(weapon2.mountDamage + damageToUse);
      else
        this.result.damage = (0, eval)(weapon2.Damage + damageToUse);
      if (this.result.charging && !this.result.other.includes(game.i18n.localize("Charging")))
        this.result.other.push(game.i18n.localize("Charging"));
      if (weapon2.properties.flaws.tiring && this.result.charging || !weapon2.properties.flaws.tiring) {
        let unitValue = Number(this.result.roll.toString().split("").pop());
        unitValue = unitValue == 0 ? 10 : unitValue;
        if (weapon2.properties.qualities.damaging && unitValue > Number(this.result.SL))
          damageToUse = unitValue;
        if (this.useMount && this.actor.mount.characteristics.s.bonus > this.actor.characteristics.s.bonus)
          this.result.damage = (0, eval)(weapon2.mountDamage + damageToUse);
        else
          this.result.damage = (0, eval)(weapon2.Damage + damageToUse);
        if (weapon2.properties.qualities.impact)
          this.result.damage += unitValue;
      }
      if (weapon2.damage.dice && !this.result.additionalDamage) {
        let roll = await new Roll(weapon2.damage.dice).roll();
        this.result.diceDamage = { value: roll.total, formula: roll.formula };
        this.preData.diceDamage = this.result.diceDamage;
        this.result.additionalDamage += roll.total;
        this.preData.additionalDamage = this.result.additionalDamage;
      }
      if (game.settings.get("wfrp4e", "mooRangedDamage")) {
        game.wfrp4e.utility.logHomebrew("mooRangedDamage");
        if (weapon2.attackType == "ranged") {
          this.result.damage -= Math.floor(this.targetModifiers / 10) || 0;
          if (this.result.damage < 0)
            this.result.damage = 0;
        }
      }
    }
    postTest() {
      super.postTest();
      let target = this.targets[0];
      if (target) {
        let impenetrable2 = false;
        let AP = target.status.armour[this.result.hitloc.result];
        for (let layer of AP.layers) {
          if (layer.impenetrable)
            impenetrable2 = true;
        }
        if (this.result.critical && impenetrable2 && this.result.roll % 2 != 0) {
          delete this.result.critical;
          this.result.nullcritical = `${game.i18n.localize("CHAT.CriticalsNullified")} (${game.i18n.localize("PROPERTY.Impenetrable")})`;
        }
      }
      if (this.result.critical && this.weapon.properties.qualities.warpstone) {
        this.result.other.push(`@Corruption[minor]{Minor Exposure to Corruption}`);
      }
      this.handleAmmo();
      this.handleDualWielder();
    }
    handleAmmo() {
      if (this.item.ammo && this.item.consumesAmmo.value && !this.context.edited && !this.context.reroll) {
        this.item.ammo.update({ "system.quantity.value": this.item.ammo.quantity.value - 1 });
      } else if (this.preData.ammoId && this.item.consumesAmmo.value && !this.context.edited && !this.context.reroll) {
        this.actor.items.get(this.preData.ammoId).update({ "system.quantity.value": this.actor.items.get(this.preData.ammoId).quantity.value - 1 });
      }
      if (this.item.loading && !this.context.edited && !this.context.reroll) {
        this.item.loaded.amt--;
        if (this.item.loaded.amt <= 0) {
          this.item.loaded.amt = 0;
          this.item.loaded.value = false;
          this.item.update({ "system.loaded.amt": this.item.loaded.amt, "system.loaded.value": this.item.loaded.value }).then((item) => {
            this.actor.checkReloadExtendedTest(item);
          });
        } else {
          this.item.update({ "system.loaded.amt": this.item.loaded.amt });
        }
      }
    }
    handleDualWielder() {
      if (this.preData.dualWielding && !this.context.edited) {
        let offHandData = duplicate(this.preData);
        if (!this.actor.hasSystemEffect("dualwielder"))
          this.actor.addSystemEffect("dualwielder");
        if (this.result.outcome == "success") {
          let offhandWeapon = this.actor.getItemTypes("weapon").find((w) => w.offhand.value);
          if (this.result.roll % 11 == 0 || this.result.roll == 100)
            delete offHandData.roll;
          else {
            let offhandRoll = this.result.roll.toString();
            if (offhandRoll.length == 1)
              offhandRoll = offhandRoll[0] + "0";
            else
              offhandRoll = offhandRoll[1] + offhandRoll[0];
            offHandData.roll = Number(offhandRoll);
          }
          this.actor.setupWeapon(offhandWeapon, { appendTitle: ` (${game.i18n.localize("SHEET.Offhand")})`, offhand: true, offhandReverse: offHandData.roll }).then((test) => test.roll());
        }
      }
    }
    get weapon() {
      return this.item;
    }
    get vehicle() {
      if (this.options.vehicle)
        return WFRP_Utility.getSpeaker(this.options.vehicle);
    }
    get characteristicKey() {
      if (this.preData.skillSelected.char)
        return this.preData.skillSelected.key;
      else {
        let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
        if (skill)
          return skill.characteristic.key;
      }
    }
    get item() {
      let actor = this.vehicle || this.actor;
      if (typeof this.preData.item == "string")
        return actor.items.get(this.preData.item);
      else
        return new CONFIG.Item.documentClass(this.preData.item, { parent: actor });
    }
  };

  // modules/system/rolls/cast-test.js
  var CastTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.preData.itemData = data.itemData || this.item.toObject();
      this.preData.skillSelected = data.skillSelected;
      this.preData.unofficialGrimoire = data.unofficialGrimoire;
      this.data.preData.malignantInfluence = data.malignantInfluence;
      this.computeTargetNumber();
      this.preData.skillSelected = data.skillSelected instanceof Item ? data.skillSelected.name : data.skillSelected;
    }
    computeTargetNumber() {
      try {
        if (this.preData.skillSelected.char)
          this.result.target = this.actor.characteristics[this.preData.skillSelected.key].value;
        else if (this.preData.skillSelected.name == this.item.skillToUse.name)
          this.result.target = this.item.skillToUse.total.value;
        else if (typeof this.preData.skillSelected == "string") {
          let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
          if (skill)
            this.result.target = skill.total.value;
        } else
          this.result.target = this.item.skillToUse.total.value;
      } catch {
        this.result.target = this.item.skillToUse.total.value;
      }
      super.computeTargetNumber();
    }
    runPreEffects() {
      super.runPreEffects();
      this.actor.runEffects("preRollCastTest", { test: this, cardOptions: this.context.cardOptions });
      if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.ingredientMode == "power" && this.hasIngredient) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        this.preData.canReverse = true;
      }
    }
    runPostEffects() {
      super.runPostEffects();
      this.actor.runEffects("rollCastTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollCastTest", this, this.context.cardOptions);
    }
    async computeResult() {
      await super.computeResult();
      let miscastCounter = 0;
      let CNtoUse = this.item.cn.value;
      this.result.overcast = duplicate(this.item.overcast);
      this.result.tooltips.miscast = [];
      if (this.preData.unofficialGrimoire && this.preData.other.indexOf(game.i18n.localize("ROLL.Reverse")) != -1) {
        if (this.data.result.roll.toString()[this.data.result.roll.toString().length - 1] == "8") {
          game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
          miscastCounter++;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.PowerIngredientMiscast"));
        }
      }
      if (game.settings.get("wfrp4e", "partialChannelling")) {
        CNtoUse -= this.preData.itemData.system.cn.SL;
      } else if (this.preData.itemData.system.cn.SL >= this.item.cn.value) {
        CNtoUse = 0;
      }
      if (this.preData.malignantInfluence) {
        if (Number(this.result.roll.toString().split("").pop()) == 8) {
          miscastCounter++;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.MalignantInfluence"));
        }
      }
      if (this.item.lore.value == "witchcraft") {
        miscastCounter++;
        this.result.other.push(game.i18n.localize("CHAT.WitchcraftMiscast"));
        this.result.tooltips.miscast.push(game.i18n.localize("CHAT.AutoWitchcraftMiscast"));
      }
      let slOver = Number(this.result.SL) - CNtoUse;
      if (this.result.outcome == "failure") {
        this.result.castOutcome = "failure";
        this.result.description = game.i18n.localize("ROLL.CastingFailed");
        if (this.preData.itemData.system.cn.SL) {
          miscastCounter++;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.ChannellingMiscast"));
        }
        if (this.result.roll % 11 == 0 || this.result.roll == 100) {
          this.result.color_red = true;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.FumbleMiscast"));
          miscastCounter++;
          if (this.result.roll == 100 && game.settings.get("wfrp4e", "mooCatastrophicMiscasts")) {
            game.wfrp4e.utility.logHomebrew("mooCatastrophicMiscasts");
            miscastCounter++;
          }
        }
        if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.overchannelling > 0) {
          game.wfrp4e.utility.logHomebrew("overchannelling");
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.OverchannellingMiscast"));
          miscastCounter++;
        }
      } else if (slOver < 0) {
        this.result.castOutcome = "failure";
        this.result.description = game.i18n.localize("ROLL.CastingFailed");
        if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.overchannelling > 0) {
          game.wfrp4e.utility.logHomebrew("overchannelling");
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.OverchannellingMiscast"));
          miscastCounter++;
        }
        if (this.result.roll % 11 == 0) {
          this.result.color_green = true;
          this.result.castOutcome = "success";
          this.result.description = game.i18n.localize("ROLL.CastingSuccess");
          this.result.critical = game.i18n.localize("ROLL.TotalPower");
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.TotalPowerMiscast"));
          miscastCounter++;
        }
      } else {
        this.result.castOutcome = "success";
        this.result.description = game.i18n.localize("ROLL.CastingSuccess");
        if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.overchannelling > 0) {
          game.wfrp4e.utility.logHomebrew("overchannelling");
          slOver += this.preData.unofficialGrimoire.overchannelling;
        }
        if (this.result.roll % 11 == 0) {
          this.result.critical = game.i18n.localize("ROLL.CritCast");
          this.result.color_green = true;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.CritCastMiscast"));
          miscastCounter++;
        }
        if (game.settings.get("wfrp4e", "mooCriticalChannelling")) {
          game.wfrp4e.utility.logHomebrew("mooCriticalChannelling");
          if (this.spell.flags.criticalchannell && CNtoUse == 0) {
            this.result.SL = "+" + Number(this.result.SL) + this.item._source.system.cn.value;
            this.result.other.push(game.i18n.localize("MOO.CriticalChanelling"));
          }
        }
      }
      if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.quickcasting && miscastCounter > 0) {
        game.wfrp4e.utility.logHomebrew("quickcasting");
        this.result.other.push(game.i18n.localize("CHAT.Quickcasting"));
        miscastCounter++;
      }
      this.result.overcasts = Math.max(0, Math.floor(slOver / 2));
      this.result.overcast.total = this.result.overcasts;
      this.result.overcast.available = this.result.overcasts;
      this._handleMiscasts(miscastCounter);
      await this._calculateDamage();
      this.result.tooltips.miscast = this.result.tooltips.miscast.join("\n");
      return this.result;
    }
    async _calculateDamage() {
      this.result.additionalDamage = this.preData.additionalDamage || 0;
      try {
        if (this.item.Damage && this.result.castOutcome == "success")
          this.result.damage = Number(this.result.SL) + Number(this.item.Damage);
        if (this.item.damage.dice && !this.result.additionalDamage) {
          let roll = await new Roll(this.item.damage.dice).roll();
          this.result.diceDamage = { value: roll.total, formula: roll.formula };
          this.preData.diceDamage = this.result.diceDamage;
          this.result.additionalDamage += roll.total;
          this.preData.additionalDamage = this.result.additionalDamage;
        }
      } catch (error2) {
        ui.notifications.error(game.i18n.localize("ErrorDamageCalc") + ": " + error2);
      }
    }
    postTest() {
      if (this.preData.unofficialGrimoire) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        if (this.preData.unofficialGrimoire.ingredientMode != "none" && this.hasIngredient && this.item.ingredient.quantity.value > 0 && !this.context.edited && !this.context.reroll) {
          this.item.ingredient.update({ "system.quantity.value": this.item.ingredient.quantity.value - 1 });
          ChatMessage.create({ speaker: this.context.speaker, content: game.i18n.localize("ConsumedIngredient") });
        }
      } else {
        if (this.hasIngredient && this.item.ingredient.quantity.value > 0 && !this.context.edited && !this.context.reroll)
          this.item.ingredient.update({ "system.quantity.value": this.item.ingredient.quantity.value - 1 });
      }
      if (this.result.overcast.enabled) {
        if (this.item.overcast.initial.type == "SL") {
          setProperty(this.result, "overcast.usage.other.initial", parseInt(this.result.SL) + (parseInt(this.item.computeSpellPrayerFormula("", false, this.spell.overcast.initial.additional)) || 0));
          setProperty(this.result, "overcast.usage.other.current", parseInt(this.result.SL) + (parseInt(this.item.computeSpellPrayerFormula("", false, this.spell.overcast.initial.additional)) || 0));
        }
      }
      if (this.result.miscastModifier) {
        if (this.result.minormis)
          this.result.minormis += ` (${this.result.miscastModifier})`;
        if (this.result.majormis)
          this.result.majormis += ` (${this.result.miscastModifier})`;
        if (this.result.catastrophicmis)
          this.result.catastrophicmis += ` (${this.result.miscastModifier})`;
      }
      if (this.item.cn.SL > 0) {
        if (this.result.castOutcome == "success" || !game.settings.get("wfrp4e", "mooCastAfterChannelling"))
          this.item.update({ "system.cn.SL": 0 });
        else if (game.settings.get("wfrp4e", "mooCastAfterChannelling")) {
          game.wfrp4e.utility.logHomebrew("mooCastAfterChannelling");
          if (this.item.cn.SL > 0 && this.result.castOutcome == "failure")
            this.result.other.push(game.i18n.localize("MOO.FailedCast"));
        }
      }
    }
    get hasIngredient() {
      return this.item.ingredient && this.item.ingredient.quantity.value > 0;
    }
    get spell() {
      return this.item;
    }
    get characteristicKey() {
      if (this.preData.skillSelected.char)
        return this.preData.skillSelected.key;
      else {
        let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
        if (skill)
          return skill.characteristic.key;
      }
    }
  };

  // modules/system/rolls/channel-test.js
  var ChannelTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.preData.unofficialGrimoire = data.unofficialGrimoire;
      this.preData.skillSelected = data.skillSelected;
      this.data.preData.malignantInfluence = data.malignantInfluence;
      this.computeTargetNumber();
      this.preData.skillSelected = data.skillSelected instanceof Item ? data.skillSelected.name : data.skillSelected;
    }
    computeTargetNumber() {
      try {
        if (this.preData.skillSelected.char)
          this.result.target = this.actor.characteristics[this.preData.skillSelected.key].value;
        else {
          let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected.name);
          if (!skill && typeof this.preData.skillSelected == "string")
            skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
          if (skill)
            this.result.target = skill.total.value;
        }
      } catch {
        let skill = this.actor.getItemTypes("skill").find((s) => s.name == `${game.i18n.localize("NAME.Channelling")} (${game.wfrp4e.config.magicWind[this.item.lore.value]})`);
        if (!skill)
          this.result.target = this.actor.characteristics.wp.value;
        else
          this.result.target = skill.total.value;
      }
      super.computeTargetNumber();
    }
    runPreEffects() {
      super.runPreEffects();
      this.actor.runEffects("preChannellingTest", { test: this, cardOptions: this.context.cardOptions });
    }
    runPostEffects() {
      super.runPostEffects();
      this.actor.runEffects("rollChannellingTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollChannelTest", this, this.context.cardOptions);
    }
    async computeResult() {
      await super.computeResult();
      let miscastCounter = 0;
      let SL = this.result.SL;
      this.result.tooltips.miscast = [];
      if (this.preData.malignantInfluence) {
        if (Number(this.result.roll.toString().split("").pop()) == 8) {
          miscastCounter++;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.MalignantInfluence"));
        }
      }
      if (this.item.lore.value == "witchcraft") {
        miscastCounter++;
        this.result.other.push(game.i18n.localize("CHAT.WitchcraftMiscast"));
        this.result.tooltips.miscast.push(game.i18n.localize("CHAT.AutoWitchcraftMiscast"));
      }
      if (this.result.outcome == "failure") {
        this.result.description = game.i18n.localize("ROLL.ChannelFailed");
        if (this.result.roll % 11 == 0 || this.result.roll % 10 == 0 || this.result.roll == 100) {
          this.result.color_red = true;
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.FumbleMiscast"));
          if (this.preData.unofficialGrimoire) {
            game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
            miscastCounter += 1;
            if (this.result.roll == 100 || this.result.roll == 99) {
              SL = this.item.cn.value * -1;
              miscastCounter += 1;
            }
          } else {
            miscastCounter += 2;
            if (this.result.roll == 100 && game.settings.get("wfrp4e", "mooCatastrophicMiscasts")) {
              game.wfrp4e.utility.logHomebrew("mooCatastrophicMiscasts");
              miscastCounter++;
            }
          }
        }
      } else {
        this.result.description = game.i18n.localize("ROLL.ChannelSuccess");
        if (this.result.roll % 11 == 0) {
          this.result.color_green = true;
          this.result.criticalchannell = game.i18n.localize("ROLL.CritChannel");
          this.result.tooltips.miscast.push(game.i18n.localize("CHAT.CritChannelMiscast"));
          miscastCounter++;
          this.spell.flags.criticalchannell = true;
        }
      }
      this._handleMiscasts(miscastCounter);
      this.result.tooltips.miscast = this.result.tooltips.miscast.join("\n");
    }
    postTest() {
      if (this.preData.unofficialGrimoire) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        if (this.preData.unofficialGrimoire.ingredientMode != "none" && this.hasIngredient && this.item.ingredient.quantity.value > 0 && !this.context.edited && !this.context.reroll) {
          this.item.ingredient.update({ "system.quantity.value": this.item.ingredient.quantity.value - 1 });
          this.result.ingredientConsumed = true;
          ChatMessage.create({ speaker: this.data.context.speaker, content: game.i18n.localize("ConsumedIngredient") });
        }
      } else {
        if (this.hasIngredient && this.item.ingredient.quantity.value > 0 && !this.context.edited && !this.context.reroll)
          this.item.ingredient.update({ "system.quantity.value": this.item.ingredient.quantity.value - 1 });
      }
      let SL = Number(this.result.SL);
      if (this.result.outcome == "success") {
        if (Number(SL) == 0 && game.settings.get("wfrp4e", "extendedTests"))
          SL = 1;
      } else {
        if (Number(SL) == 0 && game.settings.get("wfrp4e", "extendedTests"))
          SL = -1;
      }
      if (this.preData.unofficialGrimoire && this.preData.unofficialGrimoire.ingredientMode == "power" && this.result.ingredientConsumed && this.result.outcome == "success") {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire");
        SL = Number(SL) * 2;
      }
      if (Number(SL) < 0 && game.settings.get("wfrp4e", "channelingNegativeSLTests"))
        SL = 0;
      if (this.context.previousResult?.SL > 0)
        SL -= this.context.previousResult.SL;
      if (this.preData.unofficialGrimoire && this.item.cn.SL + SL > this.item.cn.value) {
        game.wfrp4e.utility.logHomebrew("unofficialgrimoire-overchannelling");
        this.result.overchannelling = this.item.cn.SL + SL - this.item.cn.value;
      }
      if (SL > 0) {
        this.result.SL = "+" + SL;
      } else {
        this.result.SL = SL.toString();
      }
      let newSL = Math.clamped(Number(this.item.cn.SL) + SL, 0, this.item.cn.value);
      if (this.result.criticalchannell)
        newSL = this.item.cn.value;
      this.item.update({ "system.cn.SL": newSL });
      this.result.CN = newSL.toString() + " / " + this.item.cn.value.toString();
      if (this.result.miscastModifier) {
        if (this.result.minormis)
          this.result.minormis += ` (${this.result.miscastModifier})`;
        if (this.result.majormis)
          this.result.majormis += ` (${this.result.miscastModifier})`;
        if (this.result.catastrophicmis)
          this.result.catastrophicmis += ` (${this.result.miscastModifier})`;
      }
    }
    get hasIngredient() {
      return this.item.ingredient && this.item.ingredient.quantity.value > 0;
    }
    get spell() {
      return this.item;
    }
    get effects() {
      return [];
    }
    get characteristicKey() {
      if (this.preData.skillSelected.char)
        return this.preData.skillSelected.key;
      else {
        let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
        if (skill)
          return skill.characteristic.key;
      }
    }
  };

  // modules/system/rolls/prayer-test.js
  var PrayerTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.preData.skillSelected = data.skillSelected;
      this.computeTargetNumber();
      this.preData.skillSelected = data.skillSelected instanceof Item ? data.skillSelected.name : data.skillSelected;
    }
    computeTargetNumber() {
      try {
        if (this.preData.skillSelected.char)
          this.result.target = this.actor.characteristics[this.preData.skillSelected.key].value;
        else if (this.preData.skillSelected.name == this.item.skillToUse.name)
          this.result.target = this.item.skillToUse.total.value;
        else if (typeof this.preData.skillSelected == "string") {
          let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
          if (skill)
            this.result.target = skill.total.value;
        } else
          this.result.target = this.item.skillToUse.total.value;
      } catch {
        this.result.target = this.item.skillToUse.total.value;
      }
      super.computeTargetNumber();
    }
    runPreEffects() {
      super.runPreEffects();
      this.actor.runEffects("preRollPrayerTest", { test: this, cardOptions: this.context.cardOptions });
    }
    runPostEffects() {
      super.runPostEffects();
      this.actor.runEffects("preRollPrayerTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollPrayerTest", this, this.context.cardOptions);
    }
    async computeResult() {
      await super.computeResult();
      let SL = this.result.SL;
      let currentSin = this.actor.status.sin.value;
      this.result.overcast = duplicate(this.item.overcast);
      if (this.result.outcome == "failure") {
        this.result.description = game.i18n.localize("ROLL.PrayRefused");
        let unitResult = Number(this.result.roll.toString().split("").pop());
        if (unitResult == 0)
          unitResult = 10;
        if (this.result.roll % 11 == 0 || unitResult <= currentSin) {
          if (this.result.roll % 11 == 0)
            this.result.color_red = true;
          this.result.wrath = game.i18n.localize("ROLL.Wrath");
          this.result.wrathModifier = Number(currentSin) * 10;
        }
      } else {
        this.result.description = game.i18n.localize("ROLL.PrayGranted");
        let unitResult = Number(this.result.roll.toString().split("").pop());
        if (unitResult == 0)
          unitResult = 10;
        if (unitResult <= currentSin) {
          this.result.wrath = game.i18n.localize("ROLL.Wrath");
          this.result.wrathModifier = Number(currentSin) * 10;
        }
      }
      this.result.overcasts = Math.floor(SL / 2);
      this.result.overcast.total = this.result.overcasts;
      this.result.overcast.available = this.result.overcast.total;
      await this._calculateDamage();
    }
    async _calculateDamage() {
      this.result.additionalDamage = this.preData.additionalDamage || 0;
      try {
        if (this.item.DamageString && this.result.outcome == "success")
          this.result.damage = Number(this.item.Damage);
        if (this.item.damage.addSL)
          this.result.damage = Number(this.result.SL) + (this.result.damage || 0);
        if (this.item.damage.dice && !this.result.additionalDamage) {
          let roll = await new Roll(this.item.damage.dice).roll();
          this.result.diceDamage = { value: roll.total, formula: roll.formula };
          this.preData.diceDamage = this.result.diceDamage;
          this.result.additionalDamage += roll.total;
          this.preData.additionalDamage = this.result.additionalDamage;
        }
      } catch (error2) {
        ui.notifications.error(game.i18n.localize("ErrorDamageCalc") + ": " + error2);
      }
    }
    postTest() {
      if (this.result.wrath) {
        let sin = this.actor.status.sin.value - 1;
        if (sin < 0)
          sin = 0;
        this.actor.update({ "system.status.sin.value": sin });
        ui.notifications.notify(game.i18n.localize("SinReduced"));
      }
    }
    async _overcast(choice) {
      if (this.result.overcast.usage[choice].AoE) {
        return ui.notifications.error(game.i18n.localize("ERROR.PrayerAoEOvercast"));
      }
      return super._overcast(choice);
    }
    get prayer() {
      return this.item;
    }
    get characteristicKey() {
      if (this.preData.skillSelected.char)
        return this.preData.skillSelected.key;
      else {
        let skill = this.actor.getItemTypes("skill").find((s) => s.name == this.preData.skillSelected);
        if (skill)
          return skill.characteristic.key;
      }
    }
  };

  // modules/system/rolls/trait-test.js
  var TraitTest = class extends TestWFRP {
    constructor(data, actor) {
      super(data, actor);
      if (!data)
        return;
      this.preData.charging = data.charging || false;
      this.preData.champion = data.champion || false;
      this.preData.options.characteristicToUse = data.characteristicToUse;
      this.computeTargetNumber();
    }
    computeTargetNumber() {
      try {
        if (this.preData.options.characteristicToUse && this.preData.options.characteristicToUse != this.item.rollable.rollCharacteristic)
          this.result.target = this.actor.characteristics[this.preData.options.characteristicToUse].value;
        else
          this.result.target = this.actor.characteristics[this.item.rollable.rollCharacteristic].value;
        if (this.item.skillToUse)
          this.result.target += this.item.skillToUse.advances.value;
      } catch {
        this.result.target += this.item.skillToUse.advances.value;
      }
      super.computeTargetNumber();
    }
    async computeResult() {
      await super.computeResult();
      await this._calculateDamage();
    }
    runPreEffects() {
      super.runPreEffects();
      this.actor.runEffects("preRollTraitTest", { test: this, cardOptions: this.context.cardOptions });
    }
    runPostEffects() {
      super.runPostEffects();
      this.actor.runEffects("rollTraitTest", { test: this, cardOptions: this.context.cardOptions });
      Hooks.call("wfrp4e:rollTraitTest", this, this.context.cardOptions);
    }
    async _calculateDamage() {
      try {
        if (this.item.rollable.damage) {
          this.result.additionalDamage = this.preData.additionalDamage || 0;
          if (this.useMount && this.actor.mount.characteristics.s.bonus > this.actor.characteristics.s.bonus)
            this.result.damage = (0, eval)(this.item.mountDamage);
          else
            this.result.damage = (0, eval)(this.item.Damage);
          if (this.item.rollable.SL)
            this.result.damage += Number(this.result.SL);
          if (this.item.rollable.dice && !this.result.additionalDamage) {
            let roll = await new Roll(this.item.rollable.dice).roll();
            this.result.diceDamage = { value: roll.total, formula: roll.formula };
            this.preData.diceDamage = this.result.diceDamage;
            this.result.additionalDamage += roll.total;
            this.preData.additionalDamage = this.result.additionalDamage;
          }
          if (game.settings.get("wfrp4e", "mooRangedDamage")) {
            game.wfrp4e.utility.logHomebrew("mooRangedDamage");
            if (this.item.attackType == "ranged") {
              this.result.damage -= Math.floor(this.targetModifiers / 10) || 0;
              if (this.result.damage < 0)
                this.result.damage = 0;
            }
          }
        }
      } catch (error2) {
        ui.notifications.error(game.i18n.localize("CHAT.DamageError") + " " + error2);
      }
    }
    get trait() {
      return this.item;
    }
    postTest() {
      super.postTest();
      let target = this.targets[0];
      if (target) {
        let impenetrable2 = false;
        let AP = target.status.armour[this.result.hitloc.result];
        for (let layer of AP.layers) {
          if (layer.impenetrable) {
            impenetrable2 = true;
            break;
          }
        }
        if (this.result.critical && impenetrable2 && this.result.roll % 2 != 0 && this.trait.system.rollable.damage) {
          delete this.result.critical;
          this.result.nullcritical = `${game.i18n.localize("CHAT.CriticalsNullified")} (${game.i18n.localize("PROPERTY.Impenetrable")})`;
        }
      }
    }
    get characteristicKey() {
      if (this.preData.options.characteristicToUse)
        return this.preData.options.characteristicToUse;
      else
        return this.item.rollable.rollCharacteristic;
    }
  };

  // modules/apps/module-updater.js
  var ModuleUpdater = class extends Dialog {
    constructor(module, html) {
      super({
        title: `${game.i18n.localize("UpdaterTitle1")} ${module.title} ${game.i18n.localize("UpdaterTitle2")}`,
        content: html,
        module,
        buttons: {
          update: {
            label: game.i18n.localize("Update"),
            callback: (html2) => {
              if (!game.settings.get(module.id, "initialized"))
                return ui.notifications.notify(game.i18n.localize("UPDATER.Error"));
              let settings = this.getUpdateSettings(html2);
              this.updateImportedContent(settings);
            }
          }
        },
        default: "update"
      });
    }
    static async create(module) {
      let html = await renderTemplate("systems/wfrp4e/templates/apps/module-updater.html", module);
      return new this(module, html);
    }
    getUpdateSettings(html) {
      let updateSettings = {};
      updateSettings.actors = html.find('[name="actors"]').is(":checked");
      updateSettings.journals = html.find('[name="journals"]').is(":checked");
      updateSettings.items = html.find('[name="items"]').is(":checked");
      updateSettings.scenes = html.find('[name="scenes"]').is(":checked");
      updateSettings.tables = html.find('[name="tables"]').is(":checked");
      updateSettings.excludeNameChange = html.find('[name="excludeNameChange"]').is(":checked");
      return updateSettings;
    }
    async updateImportedContent(settings) {
      let documents = await this.getDocuments();
      this.count = { created: 0, updated: 0 };
      for (let type in settings) {
        if (type != "excludeNameChange" && settings[type])
          await this.updateDocuments(documents[type], settings);
      }
      ui.notifications.notify(`${game.i18n.format("UPDATER.Notification", { created: this.count.created, updated: this.count.updated, name: this.data.module.name, version: this.data.module.version })}`);
    }
    async updateDocuments(documents, settings) {
      if (!documents.length)
        return;
      let toCreate = [];
      let toDelete = [];
      let documentClass;
      for (let document2 of documents) {
        if (!documentClass)
          documentClass = CONFIG[document2.documentName].documentClass;
        if (game[document2.collectionName].has(document2.id)) {
          let existingDoc = game[document2.collectionName].get(document2.id);
          if (!settings.excludeNameChange || settings.excludeNameChange && document2.name == existingDoc.name) {
            let folder = existingDoc.folder;
            let ownership = existingDoc.ownership;
            toDelete.push(existingDoc.id);
            let newDoc = document2.toObject();
            newDoc.folder = folder;
            newDoc.ownership = ownership;
            toCreate.push(newDoc);
            game.wfrp4e.utility.log(`Updated Document ${document2.name}`);
            this.count.updated++;
          }
        } else {
          let folder = document2.getFlag(this.data.module.name, "initialization-folder");
          folder = game.folders.getName(folder);
          let newDoc = document2.toObject();
          if (folder)
            newDoc.folder = folder.id;
          toCreate.push(newDoc);
          game.wfrp4e.utility.log(`Imported Document ${document2.name}`);
          this.count.created++;
        }
      }
      await documentClass.deleteDocuments(toDelete);
      let created = await documentClass.createDocuments(toCreate);
      if (documentClass.name == "Scene") {
        created.forEach(async (s) => {
          let thumb = await s.createThumbnail();
          s.update({ "thumb": thumb.thumb });
        });
      }
    }
    async getDocuments() {
      let module = this.data.module;
      let packs = module.flags.initializationPacks.map((i) => game.packs.get(i));
      let documents = {
        actors: [],
        journals: [],
        items: [],
        scenes: [],
        tables: []
      };
      for (let pack of packs) {
        let docs = await pack.getDocuments();
        switch (pack.metadata.type) {
          case "Actor":
            documents.actors = documents.actors.concat(docs);
            break;
          case "JournalEntry":
            documents.journals = documents.journals.concat(docs);
            break;
          case "Item":
            documents.items = documents.items.concat(docs);
            break;
          case "RollTable":
            documents.tables = documents.tables.concat(docs);
            break;
          case "Scene":
            documents.scenes = documents.scenes.concat(docs);
            break;
        }
      }
      return documents;
    }
  };

  // modules/apps/module-initialization.js
  var ModuleInitializer = class extends Dialog {
    constructor(module, title, html) {
      super({
        title,
        content: html,
        module: game.modules.get(module),
        buttons: {
          initialize: {
            label: "Initialize",
            callback: async () => {
              game.settings.set(module, "initialized", true);
              await this.initialize();
              ui.notifications.notify(game.modules.get(module).title + ": Initialization Complete");
            }
          },
          update: {
            label: "Update",
            condition: game.settings.get(module, "initialized"),
            callback: async () => {
              let updater = await game.wfrp4e.apps.ModuleUpdater.create(game.modules.get(module), this);
              updater.render(true);
            }
          },
          no: {
            label: "No",
            callback: () => {
              game.settings.set(module, "initialized", true);
              ui.notifications.notify("Skipped Initialization.");
            }
          }
        }
      });
      this.folders = {
        "Scene": {},
        "Item": {},
        "Actor": {},
        "JournalEntry": {},
        "RollTable": {}
      };
      this.journals = {};
      this.actors = {};
      this.scenes = {};
      this.tables = {};
      this.moduleKey = module;
      this.scenePacks = [];
    }
    async initialize() {
      return new Promise((resolve) => {
        fetch(`modules/${this.moduleKey}/initialization.json`).then(async (r) => r.json()).then(async (json) => {
          let createdFolders = await Folder.create(json);
          for (let folder of createdFolders)
            this.folders[folder.type][folder.name] = folder;
          for (let folderType in this.folders) {
            for (let folder in this.folders[folderType]) {
              let parent = this.folders[folderType][folder].getFlag(this.moduleKey, "initialization-parent");
              if (parent) {
                let parentId = this.folders[folderType][parent].id;
                await this.folders[folderType][folder].update({ parent: parentId });
              }
            }
          }
          await this.initializeEntities();
          await this.initializeScenes();
          resolve();
        });
      });
    }
    async initializeEntities() {
      let packList = this.data.module.flags.initializationPacks;
      for (let pack of packList) {
        if (game.packs.get(pack).metadata.type == "Scene") {
          this.scenePacks.push(pack);
          continue;
        }
        let documents = await game.packs.get(pack).getDocuments();
        for (let document2 of documents) {
          let folder = document2.getFlag(this.moduleKey, "initialization-folder");
          if (folder)
            document2.updateSource({ "folder": this.folders[document2.documentName][folder].id });
          if (document2.getFlag(this.moduleKey, "sort"))
            document2.updateSource({ "sort": document2.flags[this.moduleKey].sort });
        }
        try {
          switch (documents[0].documentName) {
            case "Actor":
              ui.notifications.notify(this.data.module.title + ": Initializing Actors");
              let existingDocuments = documents.filter((i) => game.actors.has(i.id));
              let newDocuments = documents.filter((i) => !game.actors.has(i.id));
              let createdActors = await Actor.create(newDocuments);
              for (let actor of createdActors)
                this.actors[actor.name] = actor;
              for (let doc of existingDocuments) {
                let existing = game.actors.get(doc.id);
                await existing.update(doc.toObject());
                ui.notifications.notify(`Updated existing document ${doc.name}`);
              }
              break;
            case "Item":
              ui.notifications.notify(this.data.module.title + ": Initializing Items");
              await Item.create(documents);
              break;
            case "JournalEntry":
              ui.notifications.notify(this.data.module.title + ": Initializing Journals");
              let createdEntries = await JournalEntry.create(documents);
              for (let entry of createdEntries)
                this.journals[entry.name] = entry;
              break;
            case "RollTable":
              ui.notifications.notify(this.data.module.title + ": Initializing Tables");
              await RollTable.create(documents);
              break;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    async initializeScenes() {
      ui.notifications.notify(this.data.module.title + ": Initializing Scenes");
      for (let pack of this.scenePacks) {
        let m = game.packs.get(pack);
        let maps = await m.getDocuments();
        for (let map of maps) {
          let folder = map.getFlag(this.moduleKey, "initialization-folder");
          if (folder)
            map.updateSource({ "folder": this.folders["Scene"][folder].id });
        }
        await Scene.create(maps).then((sceneArray) => {
          sceneArray.forEach(async (s) => {
            let thumb = await s.createThumbnail();
            s.update({ "thumb": thumb.thumb });
          });
        });
      }
    }
  };

  // modules/apps/table-config.js
  var WFRPTableConfig = class extends RollTableConfig {
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, { width: 725 });
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.prepend($(`<div class="form-group">
            <label>${game.i18n.localize("TABLE.Key")}</label>
            <input type="text" name="flags.wfrp4e.key" value="${this.object.flags.wfrp4e?.key || ""}"/>
            <label>${game.i18n.localize("TABLE.Column")}</label>
            <input type="text" name="flags.wfrp4e.column" value="${this.object.flags.wfrp4e?.column || ""}"/>
        </div>`));
    }
  };

  // modules/apps/item-dialog.js
  var ItemDialog = class extends Dialog {
    constructor(data) {
      super(data);
      this.chosen = 0;
    }
    static get defaultOptions() {
      const options = super.defaultOptions;
      options.resizable = true;
      options.classes.push("item-dialog");
      return options;
    }
    static async create(items, count = 1, text) {
      let html = await renderTemplate("systems/wfrp4e/templates/apps/item-dialog.html", { items, count, text });
      return new Promise((resolve) => {
        new ItemDialog({
          title: "Item Dialog",
          content: html,
          data: { items, count, text },
          buttons: {
            submit: {
              label: "Submit",
              callback: (html2) => {
                resolve(Array.from(html2.find(".active")).map((element) => items[element.dataset.index]));
              }
            }
          }
        }).render(true);
      });
    }
    static async createFromFilters(filters, count, text) {
      let items = await ItemDialog.filterItems(filters);
      return new Promise(async (resolve) => {
        let choice = await ItemDialog.create(items, count, text);
        resolve(choice);
      });
    }
    async getData() {
      let data = super.getData();
      return data;
    }
    static async filterItems(filters) {
      let items = game.items.contents;
      for (let p of game.packs) {
        if (p.metadata.type == "Item") {
          items = items.concat((await p.getDocuments()).filter((i) => !items.find((existing) => existing.id == i.id)));
        }
      }
      for (let f of filters) {
        if (f.regex) {
          items = items.filter((i) => Array.from(getProperty(i.data, f.property).matchAll(f.value)).length);
        } else {
          let value = f.value;
          if (!Array.isArray(value))
            value = [value];
          items = items.filter((i) => value.includes(getProperty(i.data, f.property)));
        }
      }
      return items.sort((a, b) => a.name > b.name ? 1 : -1);
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".document-name").click((ev) => {
        let document2 = $(ev.currentTarget).parents(".document")[0];
        if (document2.classList.contains("active")) {
          document2.classList.remove("active");
          this.chosen--;
        } else if (this.system.count - this.chosen > 0) {
          document2.classList.add("active");
          this.chosen++;
        }
      });
      html.find(".document-name").contextmenu((ev) => {
        let document2 = $(ev.currentTarget).parents(".document");
        let id = document2.attr("data-id");
        game.items.get(id).sheet.render(true, { editable: false });
      });
    }
  };

  // modules/system/journal-sheet.js
  var WFRPJournalTextPageSheet = class extends JournalTextPageSheet {
    async getData() {
      let data = await super.getData();
      data.headingLevels[4] = "Level 4";
      return data;
    }
  };
  Hooks.on("init", () => {
    let buildTOC = JournalEntryPage.buildTOC;
    JournalEntryPage.buildTOC = function(html) {
      let toc = buildTOC.bind(this)(html);
      for (let slug in toc) {
        if (toc[slug].element.classList.contains("no-toc"))
          delete toc[slug];
      }
      return toc;
    };
  });

  // wfrp4e.js
  Hooks.once("init", async function() {
    CONFIG.debug.wfrp4e = true;
    WFRP_Utility.log("Development Mode: Logs on");
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("wfrp4e", ActorSheetWfrp4eCharacter, { types: ["character"], makeDefault: true });
    Actors.registerSheet("wfrp4e", ActorSheetWfrp4eNPC, { types: ["npc"], makeDefault: true });
    Actors.registerSheet("wfrp4e", ActorSheetWfrp4eCreature, { types: ["creature"], makeDefault: true });
    Actors.registerSheet("wfrp4e", ActorSheetWfrp4eVehicle, { types: ["vehicle"], makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("wfrp4e", ItemSheetWfrp4e, { makeDefault: true });
    DocumentSheetConfig.registerSheet(RollTable, "wfrp4e", WFRPTableConfig, { makeDefault: true });
    DocumentSheetConfig.registerSheet(ActiveEffect, "wfrp4e", WFRPActiveEffectConfig, { makeDefault: true });
    DocumentSheetConfig.registerSheet(JournalEntryPage, "wfrp4e", WFRPJournalTextPageSheet, { types: ["text"], makeDefault: true, label: "WFRP Journal Sheet (ProseMirror)" });
    game.wfrp4e = {
      apps: {
        ActorSheetWfrp4e,
        ActorSheetWfrp4eCharacter,
        ActorSheetWfrp4eCreature,
        ActorSheetWfrp4eNPC,
        ActorSheetWfrp4eVehicle,
        ItemSheetWfrp4e,
        GeneratorWfrp4e,
        StatBlockParser,
        BrowserWfrp4e,
        ActorSettings,
        WFRPActiveEffectConfig,
        HomebrewSettings,
        CareerSelector,
        ItemProperties,
        ModuleUpdater,
        ModuleInitializer,
        ItemDialog
      },
      entities: {
        ActorWfrp4e,
        ItemWfrp4e
      },
      rolls: {
        TestWFRP,
        CharacteristicTest,
        SkillTest,
        WeaponTest,
        CastTest,
        ChannelTest,
        PrayerTest,
        TraitTest
      },
      utility: WFRP_Utility,
      tables: WFRP_Tables,
      config: config_wfrp4e_default,
      chat: ChatWFRP,
      market: MarketWfrp4e,
      audio: WFRP_Audio,
      opposed: OpposedWFRP,
      names: NameGenWfrp,
      combat: CombatHelpers,
      aoe: AbilityTemplate,
      migration: Migration,
      tags: new TagManager()
    };
    CONFIG.Actor.documentClass = ActorWfrp4e;
    CONFIG.Item.documentClass = ItemWfrp4e;
    CONFIG.ActiveEffect.documentClass = EffectWfrp4e;
  });
  registerHooks();
})();
