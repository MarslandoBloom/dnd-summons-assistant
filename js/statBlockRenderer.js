/**
 * D&D 5e Stat Block Renderer
 * This module handles accurate rendering of monster stat blocks from 5etools JSON format
 */

// Data processor functions
/**
 * Process a monster with _copy property by fetching and applying the referenced monster
 * @param {Object} monster - The monster object with _copy
 * @param {Object} sourceBooks - Object mapping source abbreviations to book names
 * @param {Function} fetchMonsterFn - Function to fetch a monster by name/source
 * @returns {Object} The processed monster with template applied
 */
function processMonsterCopy(monster, sourceBooks, fetchMonsterFn) {
    if (!monster._copy) return monster;
    
    // Make a copy of the monster to avoid modifying the original
    const result = {...monster};
    
    // Fetch the base monster
    const baseMonster = fetchMonsterFn(monster._copy.name, monster._copy.source);
    if (!baseMonster) {
        console.warn(`Base monster ${monster._copy.name} from ${monster._copy.source} not found`);
        return result;
    }
    
    // Apply templates if specified
    if (monster._copy._templates && monster._copy._templates.length > 0) {
        let processedMonster = {...baseMonster};
        
        for (const template of monster._copy._templates) {
            // Fetch the template from template.json
            const templateData = fetchTemplate(template.name, template.source);
            if (templateData) {
                processedMonster = applyTemplate(processedMonster, templateData);
            }
        }
        
        // Merge with original monster data (original takes precedence)
        return mergeMonsterData(processedMonster, result);
    }
    
    // Simple copy without templates
    return mergeMonsterData(baseMonster, result);
}

/**
 * Fetch a template from templates data
 * @param {string} name - Template name
 * @param {string} source - Template source
 * @returns {Object} The template data
 */
function fetchTemplate(name, source) {
    // This would be implemented to fetch from the template.json data
    // For now, return a placeholder
    console.log(`Fetching template ${name} from ${source}`);
    return null;
}

/**
 * Apply a template to a monster
 * @param {Object} monster - The monster to modify
 * @param {Object} template - The template to apply
 * @returns {Object} The modified monster
 */
function applyTemplate(monster, template) {
    if (!template || !template.apply) return monster;
    
    // Make a copy to avoid modifying the original
    const result = {...monster};
    
    // Apply root properties
    if (template.apply._root) {
        Object.assign(result, template.apply._root);
    }
    
    // Apply modifications
    if (template.apply._mod) {
        applyModifications(result, template.apply._mod);
    }
    
    return result;
}

/**
 * Merge monster data, with the second one taking precedence
 * @param {Object} base - Base monster data
 * @param {Object} override - Data that takes precedence
 * @returns {Object} Merged monster data
 */
function mergeMonsterData(base, override) {
    if (!base) return override;
    if (!override) return base;
    
    // Create a deep copy of the base monster
    const result = JSON.parse(JSON.stringify(base));
    
    // Merge properties, with override taking precedence
    for (const [key, value] of Object.entries(override)) {
        // Skip metadata properties (those starting with _)
        if (key.startsWith('_') && key !== '_copy' && key !== '_versions') {
            continue;
        }
        
        // Handle arrays (like actions, traits)
        if (Array.isArray(value) && Array.isArray(result[key])) {
            // For arrays, we want to append rather than replace unless specified in _mod
            result[key] = [...result[key], ...value];
        }
        // Handle objects (like speed, hp)
        else if (value !== null && typeof value === 'object' && result[key] !== null && typeof result[key] === 'object') {
            result[key] = {...result[key], ...value};
        }
        // Handle primitive values
        else {
            result[key] = value;
        }
    }
    
    return result;
}

/**
 * Process a monster's variants (_versions)
 * @param {Object} baseMonster - The base monster object
 * @returns {Array} Array of processed variant monsters
 */
function processMonsterVariants(baseMonster) {
    if (!baseMonster._versions || !Array.isArray(baseMonster._versions)) {
        return [baseMonster];
    }
    
    const variants = [];
    
    // Include the base monster if it's not just a template
    if (!baseMonster._isVariantTemplate) {
        variants.push(baseMonster);
    }
    
    // Process each variant
    for (const variant of baseMonster._versions) {
        // Create a deep copy of the base monster
        const variantMonster = JSON.parse(JSON.stringify(baseMonster));
        
        // Apply _mod changes
        if (variant._mod) {
            applyModifications(variantMonster, variant._mod);
        }
        
        // Override any direct properties
        for (const [key, value] of Object.entries(variant)) {
            if (key !== '_mod') {
                variantMonster[key] = value;
            }
        }
        
        // Mark as a variant
        variantMonster._isVariant = true;
        
        variants.push(variantMonster);
    }
    
    return variants;
}

/**
 * Apply modifications to a monster based on _mod object
 * @param {Object} monster - The monster to modify
 * @param {Object} mods - The _mod object with modifications
 */
function applyModifications(monster, mods) {
    // Process each modification type
    for (const [property, modifications] of Object.entries(mods)) {
        if (property === '_') {
            // Special case for root level modifications
            applyRootModifications(monster, modifications);
            continue;
        }
        
        if (!Array.isArray(modifications)) {
            // Handle non-array modifications (like object replacements)
            if (modifications.mode === 'replaceArr') {
                if (monster[property] && Array.isArray(monster[property])) {
                    // Find and replace the item
                    const index = monster[property].findIndex(item => 
                        (item.name === modifications.replace) || 
                        (item === modifications.replace));
                    
                    if (index !== -1) {
                        monster[property][index] = modifications.items;
                    }
                }
            } else if (modifications.mode === 'setProp') {
                // Set a property directly
                const props = modifications.prop.split('.');
                let target = monster;
                
                // Navigate to the correct nested property
                for (let i = 0; i < props.length - 1; i++) {
                    if (!target[props[i]]) {
                        target[props[i]] = {};
                    }
                    target = target[props[i]];
                }
                
                // Set the final property
                target[props[props.length - 1]] = modifications.value;
            }
            continue;
        }
        
        // Handle array of modifications
        for (const mod of modifications) {
            if (!monster[property]) {
                if (['appendArr', 'prependArr', 'appendIfNotExistsArr'].includes(mod.mode)) {
                    monster[property] = [];
                } else {
                    continue; // Skip mods for nonexistent properties
                }
            }
            
            switch (mod.mode) {
                case 'removeArr':
                    // Remove items by name or from array of names
                    if (Array.isArray(monster[property])) {
                        if (Array.isArray(mod.names)) {
                            monster[property] = monster[property].filter(item => {
                                // Handle both object items with name and string items
                                const itemName = item && typeof item === 'object' ? item.name : item;
                                return !mod.names.includes(itemName);
                            });
                        } else {
                            monster[property] = monster[property].filter(item => {
                                const itemName = item && typeof item === 'object' ? item.name : item;
                                return itemName !== mod.names;
                            });
                        }
                    }
                    break;
                    
                case 'appendArr':
                    // Add items to the end
                    if (Array.isArray(monster[property])) {
                        if (Array.isArray(mod.items)) {
                            monster[property].push(...mod.items);
                        } else {
                            monster[property].push(mod.items);
                        }
                    }
                    break;
                    
                case 'appendIfNotExistsArr':
                    // Add items to the end if they don't already exist
                    if (Array.isArray(monster[property])) {
                        const items = Array.isArray(mod.items) ? mod.items : [mod.items];
                        
                        for (const item of items) {
                            const exists = monster[property].some(existing => {
                                const existingName = existing && typeof existing === 'object' ? existing.name : existing;
                                const itemName = item && typeof item === 'object' ? item.name : item;
                                return existingName === itemName;
                            });
                            
                            if (!exists) {
                                monster[property].push(item);
                            }
                        }
                    }
                    break;
                    
                case 'prependArr':
                    // Add items to the beginning
                    if (Array.isArray(monster[property])) {
                        if (Array.isArray(mod.items)) {
                            monster[property].unshift(...mod.items);
                        } else {
                            monster[property].unshift(mod.items);
                        }
                    }
                    break;
                    
                case 'renameArr':
                    // Rename an item
                    if (Array.isArray(monster[property])) {
                        const index = monster[property].findIndex(item => 
                            item && typeof item === 'object' && item.name === mod.renames.rename);
                        
                        if (index !== -1 && monster[property][index].name) {
                            monster[property][index].name = mod.renames.with;
                        }
                    }
                    break;
                    
                case 'replaceTxt':
                    // Replace text in all string properties
                    if (Array.isArray(monster[property])) {
                        monster[property] = monster[property].map(item => {
                            if (typeof item === 'string') {
                                return item.replace(new RegExp(mod.replace, 'g'), mod.with);
                            } else if (item && typeof item === 'object') {
                                // Deep copy to avoid modifying original
                                const itemCopy = JSON.parse(JSON.stringify(item));
                                
                                // Recursively replace text in all string properties
                                function replaceInObject(obj) {
                                    for (const key in obj) {
                                        if (typeof obj[key] === 'string') {
                                            obj[key] = obj[key].replace(new RegExp(mod.replace, 'g'), mod.with);
                                        } else if (Array.isArray(obj[key])) {
                                            obj[key] = obj[key].map(subItem => {
                                                if (typeof subItem === 'string') {
                                                    return subItem.replace(new RegExp(mod.replace, 'g'), mod.with);
                                                } else if (subItem && typeof subItem === 'object') {
                                                    replaceInObject(subItem);
                                                }
                                                return subItem;
                                            });
                                        } else if (obj[key] && typeof obj[key] === 'object') {
                                            replaceInObject(obj[key]);
                                        }
                                    }
                                }
                                
                                replaceInObject(itemCopy);
                                return itemCopy;
                            }
                            return item;
                        });
                    }
                    break;
            }
        }
    }
}

/**
 * Apply root-level modifications
 * @param {Object} monster - The monster to modify
 * @param {Array} mods - The root modifications
 */
function applyRootModifications(monster, mods) {
    if (!Array.isArray(mods)) return;
    
    for (const mod of mods) {
        switch (mod.mode) {
            case 'addSenses':
                // Add senses to the monster
                if (!monster.senses) {
                    monster.senses = [];
                }
                
                const sensesToAdd = Array.isArray(mod.senses) ? mod.senses : [mod.senses];
                
                for (const sense of sensesToAdd) {
                    if (typeof sense === 'string') {
                        if (!monster.senses.includes(sense)) {
                            monster.senses.push(sense);
                        }
                    } else if (sense && typeof sense === 'object' && sense.type) {
                        // Format sense object (like {type: "darkvision", range: 60})
                        const senseStr = `${sense.type} ${sense.range} ft.`;
                        if (!monster.senses.includes(senseStr)) {
                            monster.senses.push(senseStr);
                        }
                    }
                }
                break;
                
            case 'addSkills':
                // Add skills to the monster
                if (!monster.skill) {
                    monster.skill = {};
                }
                
                for (const [skill, value] of Object.entries(mod.skills)) {
                    if (!monster.skill[skill]) {
                        monster.skill[skill] = value > 0 ? `+${value}` : `${value}`;
                    }
                }
                break;
                
            case 'maxSize':
                // Ensure the monster's size is no larger than the specified max
                const sizeOrder = { 'T': 0, 'S': 1, 'M': 2, 'L': 3, 'H': 4, 'G': 5 };
                const maxSizeValue = sizeOrder[mod.max] || 5;
                
                if (Array.isArray(monster.size)) {
                    monster.size = monster.size.filter(size => 
                        (sizeOrder[size] || 0) <= maxSizeValue
                    );
                    
                    if (monster.size.length === 0) {
                        monster.size = [mod.max];
                    }
                } else if (typeof monster.size === 'string') {
                    if ((sizeOrder[monster.size] || 0) > maxSizeValue) {
                        monster.size = mod.max;
                    }
                }
                break;
        }
    }
}

// Rendering functions
/**
 * Render a variable stat value for display in the stat block
 * @param {string|Object} stat - The stat value from JSON
 * @param {string} context - Additional context (like 'ac', 'hp', etc.)
 * @returns {string} Formatted display string
 */
function renderVariableStat(stat, context) {
    if (!stat) return '';
    
    // Handle string values
    if (typeof stat === 'string') {
        return stat;
    }
    
    // Handle numbers
    if (typeof stat === 'number') {
        return stat.toString();
    }
    
    // Handle objects (like HP)
    if (typeof stat === 'object') {
        // Special case for HP
        if (context === 'hp') {
            if (stat.special) {
                return stat.special;
            }
            if (stat.average && stat.formula) {
                return `${stat.average} (${stat.formula})`;
            }
            if (stat.average) {
                return stat.average.toString();
            }
        }
        
        // Special case for AC
        if (context === 'ac' && Array.isArray(stat)) {
            const acValues = stat.map(ac => {
                if (typeof ac === 'number') return ac.toString();
                if (ac.special) return ac.special;
                if (ac.ac) {
                    let acString = ac.ac.toString();
                    if (ac.from && ac.from.length) {
                        acString += ` (${ac.from.join(', ')})`;
                    }
                    return acString;
                }
                return '';
            }).filter(Boolean);
            
            return acValues.join(', ');
        }
        
        // Special case for speed
        if (context === 'speed' && typeof stat === 'object') {
            const speeds = [];
            
            for (const [type, value] of Object.entries(stat)) {
                if (type === 'canHover') continue;
                
                if (typeof value === 'number') {
                    speeds.push(`${type} ${value} ft.`);
                } else if (typeof value === 'object' && value.number) {
                    let speedText = `${type} ${value.number} ft.`;
                    if (value.condition) {
                        speedText += ` ${value.condition}`;
                    }
                    speeds.push(speedText);
                }
            }
            
            return speeds.join(', ');
        }
    }
    
    // For anything else, stringify it
    return JSON.stringify(stat);
}

/**
 * Parse D&D 5e formatting tags in text
 * @param {string} text - Text containing formatting tags
 * @param {Object} context - Optional context for tag resolution
 * @returns {string} Formatted text with parsed tags
 */
function parseFormattingTags(text, context = {}) {
    if (!text || typeof text !== 'string') return '';
    
    // Create a copy to avoid modifying the original
    let result = text;
    
    // Replace attack tags
    result = result.replace(/{@atk mw}/g, 'Melee Weapon Attack:')
                   .replace(/{@atk rw}/g, 'Ranged Weapon Attack:')
                   .replace(/{@atk ms}/g, 'Melee Spell Attack:')
                   .replace(/{@atk rs}/g, 'Ranged Spell Attack:');
    
    // Replace hit bonus tags
    result = result.replace(/{@hit (\d+)}/g, '+$1')
                   .replace(/{@hitYourSpellAttack}/g, '+ your spell attack modifier');
    
    // Replace damage tags
    result = result.replace(/{@damage ([^}]+)}/g, '$1');
    
    // Replace condition tags
    result = result.replace(/{@condition ([^}]+)}/g, '$1');
    
    // Replace DC tags
    result = result.replace(/{@dc (\d+)}/g, 'DC $1');
    
    // Replace dynamic values
    result = result.replace(/\bPB\b/g, context.proficiencyBonus || 'your proficiency bonus')
                   .replace(/\bsummonSpellLevel\b/g, context.spellLevel || 'the spell\'s level');
    
    // Replace recharge tags
    result = result.replace(/{@recharge}/g, 'Recharge')
                   .replace(/{@recharge (\d+)}/g, 'Recharge $1')
                   .replace(/{@recharge (\d+)-(\d+)}/g, 'Recharge $1–$2');
    
    // Replace H for "Hit:" tags
    result = result.replace(/{@h}/g, 'Hit: ');
    
    return result;
}

/**
 * Process entries array for display
 * @param {Array|string} entries - The entries to process
 * @param {Object} context - Context for tag resolution
 * @returns {string} Processed HTML for display
 */
function processEntries(entries, context = {}) {
    if (!entries) return '';
    
    // Handle string entries
    if (typeof entries === 'string') {
        return parseFormattingTags(entries, context);
    }
    
    // Handle array of entries
    if (Array.isArray(entries)) {
        return entries.map(entry => {
            if (typeof entry === 'string') {
                return parseFormattingTags(entry, context);
            }
            
            // Handle object entries with type
            if (entry.type === 'list') {
                let listHtml = '<ul class="stat-block-list">';
                
                for (const item of entry.items) {
                    if (typeof item === 'string') {
                        listHtml += `<li>${parseFormattingTags(item, context)}</li>`;
                    } else if (item.type === 'item' && item.name && item.entry) {
                        listHtml += `<li><strong>${item.name}.</strong> ${parseFormattingTags(item.entry, context)}</li>`;
                    }
                }
                
                listHtml += '</ul>';
                return listHtml;
            }
            
            // Handle object entries with name/entries
            if (entry.name && entry.entries) {
                return `<p><strong>${entry.name}.</strong> ${processEntries(entry.entries, context)}</p>`;
            }
            
            return '';
        }).join('');
    }
    
    return '';
}

/**
 * Render a complete creature stat block
 * @param {Object} creature - The creature to render
 * @param {Object} context - Context for variable data resolution
 * @returns {string} HTML for the stat block
 */
function renderCreatureStatBlock(creature, context = {}) {
    // Handle base creature if it has variants
    if (creature._versions && !context.processVariants) {
        const variantNames = creature._versions.map(v => v.name).join(', ');
        return `
            <div class="statblock">
                <div class="creature-warning">
                    <p>This creature has variants: ${variantNames}</p>
                    <p>Please select a specific variant to view its stat block.</p>
                </div>
            </div>
        `;
    }
    
    // Prepare context for tag parsing
    const parsingContext = {
        proficiencyBonus: context.proficiencyBonus || 'PB',
        spellLevel: context.spellLevel || 'the spell\'s level'
    };
    
    // Now render the stat block
    return `
        <div class="statblock">
            <div class="creature-header">
                <div class="name-cr-line">
                    <h1>${creature.name}</h1>
                    <div class="creature-cr">CR ${formatChallengeRating(creature.cr)}</div>
                </div>
                <div class="creature-size-type-alignment">
                    ${getSizeString(creature.size)} ${getTypeWithTags(creature.type)}, ${getAlignmentString(creature.alignment)}
                </div>
                ${creature.summonedBySpell ? `<div class="summoning-info">Summoned by the ${creature.summonedBySpell} spell (level ${creature.summonedBySpellLevel}+)</div>` : ''}
                ${creature.summonedByClass ? `<div class="summoning-info">Summoned by the ${creature.summonedByClass} class</div>` : ''}
            </div>
            
            <div class="creature-attributes">
                <div class="attribute-line">
                    <div class="attribute-name">Armor Class</div>
                    <div class="attribute-value">${renderVariableStat(creature.ac, 'ac')}</div>
                </div>
                <div class="attribute-line">
                    <div class="attribute-name">Hit Points</div>
                    <div class="attribute-value">${renderVariableStat(creature.hp, 'hp')}</div>
                </div>
                <div class="attribute-line">
                    <div class="attribute-name">Speed</div>
                    <div class="attribute-value">${renderVariableStat(creature.speed, 'speed')}</div>
                </div>
            </div>
            
            <div class="ability-scores">
                <div class="ability">
                    <div class="ability-name">STR</div>
                    <div class="ability-score">${creature.str} (${getAbilityModifier(creature.str)})</div>
                </div>
                <div class="ability">
                    <div class="ability-name">DEX</div>
                    <div class="ability-score">${creature.dex} (${getAbilityModifier(creature.dex)})</div>
                </div>
                <div class="ability">
                    <div class="ability-name">CON</div>
                    <div class="ability-score">${creature.con} (${getAbilityModifier(creature.con)})</div>
                </div>
                <div class="ability">
                    <div class="ability-name">INT</div>
                    <div class="ability-score">${creature.int} (${getAbilityModifier(creature.int)})</div>
                </div>
                <div class="ability">
                    <div class="ability-name">WIS</div>
                    <div class="ability-score">${creature.wis} (${getAbilityModifier(creature.wis)})</div>
                </div>
                <div class="ability">
                    <div class="ability-name">CHA</div>
                    <div class="ability-score">${creature.cha} (${getAbilityModifier(creature.cha)})</div>
                </div>
            </div>
            
            <div class="creature-details">
                ${renderSavingThrows(creature.save)}
                ${renderSkills(creature.skill)}
                ${renderResistancesAndImmunities(creature.resist, 'Damage Resistances')}
                ${renderResistancesAndImmunities(creature.immune, 'Damage Immunities')}
                ${renderResistancesAndImmunities(creature.vulnerable, 'Damage Vulnerabilities')}
                ${renderResistancesAndImmunities(creature.conditionImmune, 'Condition Immunities')}
                ${renderSenses(creature.senses, creature.passive)}
                ${renderLanguages(creature.languages)}
            </div>
            
            ${renderCreatureSection(creature.trait, 'Traits', parsingContext)}
            ${creature.spellcasting ? renderSpellcasting(creature.spellcasting, parsingContext) : ''}
            ${renderCreatureSection(creature.action, 'Actions', parsingContext)}
            ${renderCreatureSection(creature.bonus, 'Bonus Actions', parsingContext)}
            ${renderCreatureSection(creature.reaction, 'Reactions', parsingContext)}
            ${renderCreatureSection(creature.legendary, 'Legendary Actions', parsingContext)}
        </div>
    `;
}

/**
 * Render a specific section of a creature (traits, actions, etc.)
 * @param {Array} items - The items to render
 * @param {string} title - The section title
 * @param {Object} context - Context for tag parsing
 * @returns {string} HTML for the section
 */
function renderCreatureSection(items, title, context) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return '';
    }
    
    let html = `<div class="creature-section">
        <h3>${title}</h3>`;
    
    html += items.map(item => {
        if (typeof item === 'string') {
            return `<p>${parseFormattingTags(item, context)}</p>`;
        }
        
        // Handle named entries (like traits, actions)
        if (item.name && item.entries) {
            return `
                <div class="creature-feature">
                    <div class="feature-name">${item.name}.</div>
                    <div class="feature-description">${processEntries(item.entries, context)}</div>
                </div>
            `;
        }
        
        return '';
    }).join('');
    
    html += '</div>';
    return html;
}

/**
 * Helper functions for rendering
 */

/**
 * Format challenge rating for display
 * @param {string|number|Object} cr - The challenge rating
 * @returns {string} Formatted CR
 */
function formatChallengeRating(cr) {
    if (!cr) return '0';
    
    if (typeof cr === 'string') {
        return cr;
    }
    
    if (typeof cr === 'number') {
        if (cr === 0.125) return '1/8';
        if (cr === 0.25) return '1/4';
        if (cr === 0.5) return '1/2';
        return cr.toString();
    }
    
    if (typeof cr === 'object' && cr.cr) {
        return formatChallengeRating(cr.cr);
    }
    
    return '0';
}

/**
 * Get ability score modifier string
 * @param {number} score - The ability score
 * @returns {string} Formatted modifier (+1, -1, etc.)
 */
function getAbilityModifier(score) {
    const modifier = Math.floor((score - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Get size string from size code
 * @param {string|Array} size - Size code(s)
 * @returns {string} Size string
 */
function getSizeString(size) {
    if (!size) return 'Medium';
    
    const sizeMap = {
        'T': 'Tiny',
        'S': 'Small',
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan'
    };
    
    if (typeof size === 'string') {
        return sizeMap[size] || size;
    }
    
    if (Array.isArray(size)) {
        return size.map(s => sizeMap[s] || s).join(' or ');
    }
    
    return 'Medium';
}

/**
 * Get type string with tags
 * @param {string|Object} type - Creature type
 * @returns {string} Formatted type string
 */
function getTypeWithTags(type) {
    if (!type) return 'creature';
    
    if (typeof type === 'string') {
        return type;
    }
    
    if (typeof type === 'object') {
        let typeString = type.type || 'creature';
        
        if (type.tags && Array.isArray(type.tags)) {
            const formattedTags = type.tags.map(tag => {
                if (typeof tag === 'string') {
                    return tag;
                }
                if (typeof tag === 'object' && tag.tag) {
                    return tag.prefix ? `${tag.prefix} ${tag.tag}` : tag.tag;
                }
                return '';
            }).filter(Boolean);
            
            if (formattedTags.length > 0) {
                typeString += ` (${formattedTags.join(', ')})`;
            }
        }
        
        return typeString;
    }
    
    return 'creature';
}

/**
 * Get alignment string
 * @param {string|Array} alignment - Alignment code(s)
 * @returns {string} Formatted alignment string
 */
function getAlignmentString(alignment) {
    if (!alignment) return 'unaligned';
    
    const alignmentMap = {
        'L': 'lawful',
        'N': 'neutral',
        'C': 'chaotic',
        'G': 'good',
        'E': 'evil',
        'U': 'unaligned',
        'A': 'any alignment'
    };
    
    if (typeof alignment === 'string') {
        return alignmentMap[alignment] || alignment;
    }
    
    if (Array.isArray(alignment)) {
        // Special cases
        if (alignment.includes('U')) return 'unaligned';
        if (alignment.includes('A')) return 'any alignment';
        
        // Compose alignment string
        let alignString = '';
        
        // First part (lawful/neutral/chaotic)
        if (alignment.includes('L')) alignString += 'lawful ';
        else if (alignment.includes('C')) alignString += 'chaotic ';
        else if (alignment.includes('N') && !alignment.includes('G') && !alignment.includes('E')) {
            return 'neutral';
        }
        
        // Second part (good/evil/neutral)
        if (alignment.includes('G')) alignString += 'good';
        else if (alignment.includes('E')) alignString += 'evil';
        else if (alignment.includes('N') && !alignString.includes('neutral')) {
            alignString += 'neutral';
        }
        
        return alignString.trim();
    }
    
    return 'unaligned';
}

/**
 * Render saving throws
 * @param {Object} saves - Saving throw bonuses
 * @returns {string} HTML for saving throws
 */
function renderSavingThrows(saves) {
    if (!saves || Object.keys(saves).length === 0) {
        return '';
    }
    
    const saveStrings = [];
    
    for (const [ability, bonus] of Object.entries(saves)) {
        const abilityName = ability.toUpperCase();
        saveStrings.push(`${abilityName} ${bonus}`);
    }
    
    return `
        <div class="detail-line">
            <div class="detail-name">Saving Throws</div>
            <div class="detail-value">${saveStrings.join(', ')}</div>
        </div>
    `;
}

/**
 * Render skills
 * @param {Object} skills - Skill bonuses
 * @returns {string} HTML for skills
 */
function renderSkills(skills) {
    if (!skills || Object.keys(skills).length === 0) {
        return '';
    }
    
    const skillStrings = [];
    const skillMap = {
        'acrobatics': 'Acrobatics',
        'animal handling': 'Animal Handling',
        'arcana': 'Arcana',
        'athletics': 'Athletics',
        'deception': 'Deception',
        'history': 'History',
        'insight': 'Insight',
        'intimidation': 'Intimidation',
        'investigation': 'Investigation',
        'medicine': 'Medicine',
        'nature': 'Nature',
        'perception': 'Perception',
        'performance': 'Performance',
        'persuasion': 'Persuasion',
        'religion': 'Religion',
        'sleight of hand': 'Sleight of Hand',
        'stealth': 'Stealth',
        'survival': 'Survival'
    };
    
    for (const [skill, bonus] of Object.entries(skills)) {
        const skillName = skillMap[skill] || skill.charAt(0).toUpperCase() + skill.slice(1);
        skillStrings.push(`${skillName} ${bonus}`);
    }
    
    return `
        <div class="detail-line">
            <div class="detail-name">Skills</div>
            <div class="detail-value">${skillStrings.join(', ')}</div>
        </div>
    `;
}

/**
 * Render resistances, immunities, or vulnerabilities
 * @param {Array|string} items - The items to render
 * @param {string} title - The section title
 * @returns {string} HTML for the section
 */
function renderResistancesAndImmunities(items, title) {
    if (!items || (Array.isArray(items) && items.length === 0)) {
        return '';
    }
    
    let itemStrings = [];
    
    if (typeof items === 'string') {
        itemStrings.push(items);
    } else if (Array.isArray(items)) {
        itemStrings = items.map(item => {
            if (typeof item === 'string') {
                return item;
            }
            
            if (typeof item === 'object') {
                // Handle conditional resistances
                if (item.resist && item.cond) {
                    const resistList = Array.isArray(item.resist) 
                        ? item.resist.join(', ') 
                        : item.resist;
                    
                    return `${resistList} ${item.note || ''}`;
                }
                
                // Handle conditional immunities
                if (item.immune && item.cond) {
                    const immuneList = Array.isArray(item.immune) 
                        ? item.immune.join(', ') 
                        : item.immune;
                    
                    return `${immuneList} ${item.note || ''}`;
                }
            }
            
            return '';
        }).filter(Boolean);
    }
    
    if (itemStrings.length === 0) {
        return '';
    }
    
    return `
        <div class="detail-line">
            <div class="detail-name">${title}</div>
            <div class="detail-value">${itemStrings.join(', ')}</div>
        </div>
    `;
}

/**
 * Render senses
 * @param {Array} senses - Creature senses
 * @param {number} passivePerception - Passive perception
 * @returns {string} HTML for senses
 */
function renderSenses(senses, passivePerception) {
    const sensesArray = [];
    
    if (senses && Array.isArray(senses)) {
        sensesArray.push(...senses);
    }
    
    if (passivePerception) {
        sensesArray.push(`passive Perception ${passivePerception}`);
    }
    
    if (sensesArray.length === 0) {
        return '';
    }
    
    return `
        <div class="detail-line">
            <div class="detail-name">Senses</div>
            <div class="detail-value">${sensesArray.join(', ')}</div>
        </div>
    `;
}

/**
 * Render languages
 * @param {Array} languages - Creature languages
 * @returns {string} HTML for languages
 */
function renderLanguages(languages) {
    if (!languages || !Array.isArray(languages) || languages.length === 0) {
        return `
            <div class="detail-line">
                <div class="detail-name">Languages</div>
                <div class="detail-value">—</div>
            </div>
        `;
    }
    
    return `
        <div class="detail-line">
            <div class="detail-name">Languages</div>
            <div class="detail-value">${languages.join(', ')}</div>
        </div>
    `;
}

/**
 * Render spellcasting information
 * @param {Array} spellcasting - Spellcasting data
 * @param {Object} context - Context for tag parsing
 * @returns {string} HTML for spellcasting
 */
function renderSpellcasting(spellcasting, context) {
    if (!spellcasting || !Array.isArray(spellcasting) || spellcasting.length === 0) {
        return '';
    }
    
    let html = `<div class="creature-section">
        <h3>Spellcasting</h3>`;
    
    html += spellcasting.map(caster => {
        let casterHtml = '';
        
        if (caster.name) {
            casterHtml += `<div class="spellcasting-type">${caster.name}</div>`;
        }
        
        if (caster.headerEntries) {
            casterHtml += `<div class="spellcasting-description">${processEntries(caster.headerEntries, context)}</div>`;
        }
        
        // Spell lists
        const spellLists = [];
        
        // Cantrips/At will
        if (caster.will && caster.will.length > 0) {
            spellLists.push(`<div class="spell-group">
                <div class="spell-frequency">At will:</div>
                <div class="spell-list">${caster.will.join(', ')}</div>
            </div>`);
        }
        
        // Daily spells
        if (caster.daily && Object.keys(caster.daily).length > 0) {
            for (const [frequency, spells] of Object.entries(caster.daily)) {
                const uses = frequency.replace('e', '');
                spellLists.push(`<div class="spell-group">
                    <div class="spell-frequency">${uses}/day each:</div>
                    <div class="spell-list">${spells.join(', ')}</div>
                </div>`);
            }
        }
        
        // Spells by level
        if (caster.spells && Object.keys(caster.spells).length > 0) {
            for (const [level, spellData] of Object.entries(caster.spells)) {
                const levelNum = parseInt(level);
                const levelName = levelNum === 0 ? 'Cantrips (at will)' : `${levelNum}${getOrdinalSuffix(levelNum)} level`;
                
                let slotsText = '';
                if (spellData.slots) {
                    slotsText = ` (${spellData.slots} slot${spellData.slots > 1 ? 's' : ''})`;
                }
                
                spellLists.push(`<div class="spell-group">
                    <div class="spell-level">${levelName}${slotsText}:</div>
                    <div class="spell-list">${spellData.spells.join(', ')}</div>
                </div>`);
            }
        }
        
        if (spellLists.length > 0) {
            casterHtml += spellLists.join('');
        }
        
        return casterHtml;
    }).join('');
    
    html += '</div>';
    return html;
}

/**
 * Get ordinal suffix for a number
 * @param {number} num - The number
 * @returns {string} Ordinal suffix
 */
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) {
        return 'st';
    }
    if (j === 2 && k !== 12) {
        return 'nd';
    }
    if (j === 3 && k !== 13) {
        return 'rd';
    }
    return 'th';
}

// Main function for displaying creature details
/**
 * Display details of a creature with proper handling of variants and templates
 * @param {string} creatureId - The ID of the creature to display
 * @param {Function} getAllCreatures - Function to get all creatures
 * @param {Function} fetchMonster - Function to fetch a monster by name and source
 * @param {Object} options - Additional options for display
 * @returns {string} HTML for the creature display
 */
function displayCreatureDetails(creatureId, getAllCreatures, fetchMonster, options = {}) {
    // Get all creatures
    const creatures = getAllCreatures();
    
    // Find the requested creature
    const creature = creatures.find(c => c.id === creatureId);
    
    if (!creature) {
        return `<div class="error-message">Creature with ID ${creatureId} not found.</div>`;
    }
    
    // Check if we need to process the _copy property
    if (creature._copy) {
        // Create source book mapping for lookup
        const sourceBooks = createSourceBookMapping();
        
        // Process the creature with copy and templates
        const processedCreature = processMonsterCopy(creature, sourceBooks, fetchMonster);
        
        // Now render the processed creature
        return renderCreatureStatBlock(processedCreature, options);
    }
    
    // Check if we have variants to handle
    if (creature._versions && Array.isArray(creature._versions) && creature._versions.length > 0) {
        // If a specific variant is requested
        if (options.variant) {
            // Find the requested variant
            const variant = creature._versions.find(v => v.name === options.variant);
            
            if (variant) {
                // Process the variant
                const variantCreatures = processMonsterVariants(creature);
                const processed = variantCreatures.find(v => v.name === options.variant);
                
                if (processed) {
                    return renderCreatureStatBlock(processed, options);
                }
            }
            
            return `<div class="error-message">Variant ${options.variant} not found for creature ${creature.name}.</div>`;
        }
        
        // If no specific variant is requested, show a selection dialog
        return renderVariantSelection(creature);
    }
    
    // Simple case - just render the creature
    return renderCreatureStatBlock(creature, options);
}

/**
 * Render a selection dialog for creature variants
 * @param {Object} creature - The base creature with variants
 * @returns {string} HTML for the variant selection
 */
function renderVariantSelection(creature) {
    if (!creature._versions || !Array.isArray(creature._versions) || creature._versions.length === 0) {
        return renderCreatureStatBlock(creature, { processVariants: true });
    }
    
    let html = `
        <div class="variant-selection">
            <h2>${creature.name} Variants</h2>
            <p>This creature has multiple variants. Please select one to view:</p>
            <ul class="variant-list">
    `;
    
    // Add the base creature if it's a complete creature (not just a template)
    if (!creature._isVariantTemplate) {
        html += `<li><a href="#" class="variant-link" data-id="${creature.id}" data-variant="">Base ${creature.name}</a></li>`;
    }
    
    // Add all variants
    for (const variant of creature._versions) {
        html += `<li><a href="#" class="variant-link" data-id="${creature.id}" data-variant="${variant.name}">${variant.name}</a></li>`;
    }
    
    html += `
            </ul>
        </div>
    `;
    
    return html;
}

/**
 * Create a mapping of source abbreviations to book names
 * @returns {Object} Mapping of sources
 */
function createSourceBookMapping() {
    // This would normally load from index.json
    // For now, hard-code common sources
    return {
        "MM": "Monster Manual",
        "DMG": "Dungeon Master's Guide",
        "PHB": "Player's Handbook",
        "TCE": "Tasha's Cauldron of Everything",
        "VGM": "Volo's Guide to Monsters",
        "MTF": "Mordenkainen's Tome of Foes",
        "MOT": "Mythic Odysseys of Theros",
        "EGW": "Explorer's Guide to Wildemount",
        "ERLW": "Eberron: Rising from the Last War",
        "EEPC": "Elemental Evil Player's Companion",
        "XGTE": "Xanathar's Guide to Everything",
        "CoS": "Curse of Strahd",
        "TftYP": "Tales from the Yawning Portal"
    };
}

/**
 * Helper function to extract scaling information for summoned creatures
 * @param {Object} creature - The creature to process
 * @param {number} level - The summoning level
 * @returns {Object} Context object with scaling values
 */
function getScalingContext(creature, level) {
    if (!creature || !level) {
        return {};
    }
    
    const context = { 
        spellLevel: level,
        proficiencyBonus: Math.ceil(level / 4) + 1 // Simple approximation
    };
    
    // Check if this creature has special scaling in foundry.json
    if (creature.summonedBySpell || creature.summonedByClass) {
        // This would normally fetch from foundry.json
        // For now, just use the basic scaling info
    }
    
    return context;
}

// CSS for styling stat blocks
const statBlockCSS = `
.statblock {
    font-family: 'Noto Serif', 'Palatino Linotype', serif;
    background: #fdf1dc;
    padding: 1rem;
    border: 1px solid #ddd;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
    margin: 1rem 0;
    max-width: 800px;
    position: relative;
    color: #333;
}

.creature-header {
    border-bottom: 2px solid #922610;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
}

.name-cr-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.creature-header h1 {
    font-size: 2rem;
    font-family: 'Libre Baskerville', 'Lora', 'Calisto MT', 'Bookman Old Style', serif;
    margin: 0;
    color: #922610;
}

.creature-cr {
    font-weight: bold;
}

.creature-size-type-alignment {
    font-style: italic;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
}

.summoning-info {
    font-size: 0.9rem;
    font-style: italic;
    color: #666;
}

.creature-attributes {
    background: #e9d7a0;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
}

.attribute-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.3rem;
}

.attribute-line:last-child {
    margin-bottom: 0;
}

.attribute-name {
    font-weight: bold;
}

.ability-scores {
    display: flex;
    justify-content: space-between;
    margin: 0.5rem 0;
    text-align: center;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    padding: 0.5rem 0;
}

.ability {
    flex: 1;
}

.ability-name {
    font-weight: bold;
}

.creature-details {
    margin: 0.5rem 0;
}

.detail-line {
    margin-bottom: 0.3rem;
}

.detail-name {
    font-weight: bold;
    display: inline;
}

.detail-value {
    display: inline;
    margin-left: 0.5rem;
}

.creature-section {
    margin: 1rem 0;
}

.creature-section h3 {
    border-bottom: 1px solid #922610;
    font-size: 1.2rem;
    color: #922610;
    margin-bottom: 0.5rem;
}

.creature-feature {
    margin-bottom: 0.5rem;
}

.feature-name {
    font-weight: bold;
    font-style: italic;
    display: inline;
}

.feature-description {
    display: inline;
    margin-left: 0.5rem;
}

.stat-block-list {
    padding-left: 1rem;
    margin: 0.5rem 0;
}

.spellcasting-type {
    font-weight: bold;
    font-style: italic;
}

.spellcasting-description {
    margin-bottom: 0.5rem;
}

.spell-group {
    margin-bottom: 0.3rem;
}

.spell-frequency, .spell-level {
    font-weight: bold;
    display: inline;
}

.spell-list {
    display: inline;
    margin-left: 0.5rem;
}

.variant-selection {
    background: #f8f8f8;
    padding: 1rem;
    border: 1px solid #ddd;
    margin: 1rem 0;
}

.variant-list {
    list-style-type: none;
    padding-left: 0;
}

.variant-list li {
    margin-bottom: 0.5rem;
}

.variant-link {
    color: #922610;
    text-decoration: none;
    font-weight: bold;
}

.variant-link:hover {
    text-decoration: underline;
}

.error-message {
    color: #922610;
    font-weight: bold;
    padding: 1rem;
    background: #fdf1dc;
    border: 1px solid #922610;
}
`;

// Export the functions for use in the main application
export { 
    displayCreatureDetails,
    renderCreatureStatBlock,
    processMonsterVariants,
    processMonsterCopy,
    parseFormattingTags,
    getScalingContext,
    statBlockCSS
};

// Add CSS to document
const style = document.createElement('style');
style.textContent = statBlockCSS;
document.head.appendChild(style);