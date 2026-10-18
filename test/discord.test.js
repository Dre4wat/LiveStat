import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWebhook,safeDiscordMessage,sendDiscordAlert} from '../src/engine/discord.js';
const valid='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';
test('Discord accepts direct HTTPS webhook URLs only',()=>{
 assert.equal(validateWebhook(valid),true);
 assert.equal(validateWebhook('https://discord.com.evil.test/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN'),false);
 assert.equal(validateWebhook('http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN'),false);
 assert.equal(validateWebhook('https://discord.com/api/webhooks/invalid/token'),false);
});
test('No Discord mass mentions and safely bounded message',()=>{
 const p=safeDiscordMessage({category:'target',name:'@everyone',detail:'@here Great news!',game:'Sample'});
 assert.deepEqual(p.allowed_mentions,{parse:[]});
 assert.equal(p.embeds.length,1);
});
test('Discord alerts are optional and filtered by type',async()=>{
 let calls=0;
 const fake=async()=>{calls++;return {ok:true}};
 assert.equal((await sendDiscordAlert({enabled:false,url:valid,types:['target']},{category:'target',name:'Test'},fake)).sent,false);
 assert.equal((await sendDiscordAlert({enabled:true,url:valid,types:['target']},{category:'every',name:'Test'},fake)).sent,false);
 assert.equal((await sendDiscordAlert({enabled:true,url:valid,types:['target']},{category:'target',name:'Test',ownerId:'unit'},fake)).sent,true);
 assert.equal(calls,1);
});
