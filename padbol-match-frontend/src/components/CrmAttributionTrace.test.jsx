import {render,screen} from '@testing-library/react';
import CrmAttributionTrace,{resolveOrigin} from './CrmAttributionTrace';

const at='2026-11-01T19:11:37Z';
function lead(extra={}){return {id:'A',created_at:at,...extra};}

test('muestra fuente, campaña y fecha cuando el formulario trae UTMs de Meta',()=>{
 render(<CrmAttributionTrace conversation={lead({qualification_data:{form_submission:{fields:{utm_source:'fb',utm_medium:'paid',utm_id:'120240275542960660'}}}})}/>);
 expect(screen.getByRole('heading',{name:'Origen del interesado'})).toBeInTheDocument();
 expect(screen.getByText('Meta (Facebook) · pago')).toBeInTheDocument();
 expect(screen.getByText('120240275542960660')).toBeInTheDocument();
 expect(screen.queryByText(/UTM|actividad registrada|Consultar actividad/i)).toBeNull();
});

test('un formulario sin UTMs conserva el origen conocido sin inventar campaña',()=>{
 const {campaign,source}=resolveOrigin(lead({origin:'web_form:contacto',source_channel:'email'}));
 expect(source).toBe('Formulario web');
 expect(campaign).toBeNull();
 render(<CrmAttributionTrace conversation={lead({origin:'web_form:contacto',source_channel:'email'})}/>);
 expect(screen.getByText('Formulario web')).toBeInTheDocument();
 expect(screen.queryByText('Campaña')).toBeNull();
});

test('sin origen ni campos muestra Origen no identificado',()=>{
 render(<CrmAttributionTrace conversation={lead({})}/>);
 expect(screen.getByText('Origen no identificado')).toBeInTheDocument();
 expect(screen.queryByText('Campaña')).toBeNull();
 expect(screen.queryByText(/UTM|actividad/i)).toBeNull();
});

test('distingue Google Ads y Meta por click id sin atribuir una campaña',()=>{
 expect(resolveOrigin(lead({qualification_data:{form_submission:{fields:{gclid:'gclid-fixture'}}}})).source).toBe('Google Ads');
 expect(resolveOrigin(lead({qualification_data:{form_submission:{fields:{fbclid:'fbclid-fixture'}}}})).source).toBe('Meta');
});

test('WhatsApp y email se identifican por su origen real',()=>{
 expect(resolveOrigin(lead({origin:'whatsapp:1376102838911694',source_channel:'whatsapp'})).source).toBe('WhatsApp');
 expect(resolveOrigin(lead({origin:'support_email',source_channel:'email'})).source).toBe('Email');
});
