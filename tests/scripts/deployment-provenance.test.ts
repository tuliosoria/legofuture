import {describe,it,expect} from 'vitest';
import {provenance} from '../../scripts/ci/write-deployment-provenance.mjs';
describe('deployment provenance',()=>{
 it('contains only public service and actual checkout SHA',()=>expect(provenance('a'.repeat(40),'HEAD')).toEqual({service:'legofuture',commit:'a'.repeat(40)}));
 it('refuses mismatched metadata',()=>expect(()=>provenance('a'.repeat(40),'b'.repeat(40))).toThrow('differ'));
 it('refuses missing sha',()=>expect(()=>provenance('',undefined)).toThrow());
});
