export const treatmentTopics=['Crowns','Fillings','Root canals','Gum care','Extractions','Implants','Bridges'];
const guide='Cedar Dental patient guide · treatments';
const definitions=[
 ['Fillings','filling','What does a filling do?','A filling repairs a hole in a tooth caused by decay. Your dentist chooses the material based on your tooth and treatment needs.',guide],
 ['Root canals','root-canal','What does root canal treatment do?','Root canal treatment cleans and seals the inside of a tooth to treat infection and help keep the tooth. Your dentist will explain the plan for restoring the tooth afterward.',guide],
 ['Gum care','gum-care','What is a deep cleaning?','Scaling and root planing is a cleaning below the gumline used to treat gum disease. It removes plaque and tartar and smooths the root surfaces.',guide],
 ['Extractions','extraction','Why was an extraction recommended?','The reason for removing a tooth comes from your dentist’s assessment. I can explain the recorded recommendation and help arrange a discussion before you decide.','Patient treatment plan'],
 ['Implants','implant','What does a dental implant do?','An implant is placed in the jaw to support a replacement tooth or other dental restoration. Your dentist will discuss whether it is appropriate for you.',guide],
 ['Bridges','bridge','What does a dental bridge do?','A bridge is a fixed replacement for one or more missing teeth. Your dentist will explain how it would be supported and whether it suits your situation.',guide]
];
// What to expect, per treatment (general guidance; the dentist confirms what applies to each patient).
const visits={
 Crowns:['crown','What should I expect at my crown appointment?','A crown usually takes two visits. At the first, the tooth is shaped and a temporary crown is fitted. At the second, the permanent crown is placed. Your dentist will confirm what applies to you.'],
 Fillings:['filling','What should I expect at my filling appointment?','Most fillings take 30 to 60 minutes. The area is usually numbed first, and you can eat once the numbness wears off. Your dentist will confirm what applies to you.'],
 'Root canals':['root-canal','What should I expect at my root canal appointment?','Root canal treatment usually takes 60 to 90 minutes with a local anesthetic. Afterward, the tooth often needs a crown to protect it. Your dentist will explain the plan for your tooth.'],
 'Gum care':['gum-care','What should I expect at my deep cleaning?','A deep cleaning is often done one side of the mouth at a time, with numbing. Your gums may feel tender for a few days afterward. Your dentist will confirm what applies to you.'],
 Extractions:['extraction','What should I expect when a tooth is removed?','The area is numbed before the tooth is removed. The team will give you aftercare instructions and talk through options for replacing the tooth, if needed.'],
 Implants:['implant','What should I expect with implant treatment?','Implant treatment happens over several visits, with healing time in between. Your dentist will walk you through each step before you begin.'],
 Bridges:['bridge','What should I expect when getting a bridge?','A bridge usually takes two visits: one to prepare the supporting teeth and take impressions, and one to fit the bridge. Your dentist will confirm what applies to you.']
};
export const visitEntries=Object.entries(visits).map(([topic,[slug,question,answer]])=>({id:`kb-${slug}-visit`,topic,question,answer,source:guide,chart:false}));
export const treatmentEntries=[
 ...definitions.map(([topic,slug,question,answer,source])=>({id:`kb-${slug}-overview`,topic,question,answer,source,chart:/^why\b/i.test(question)})),
 ...visitEntries
];
// Fixed fictional examples, grounded in the prototype's existing patient charts.
export const chartExamples={
 Crowns:'Dr. Lee noted a crack in tooth 30 and recommended a crown to protect and support the remaining tooth.',
 Fillings:'Dr. Lee recorded decay in tooth 14 and recommended a filling.',
 'Root canals':'Dr. Lee recommended root canal treatment for tooth 19 after your assessment.',
 'Gum care':'After your gum assessment, Dr. Lee recommended periodontal therapy for the lower-right area.',
 Extractions:'Dr. Lee recorded that tooth 16 could not be restored and recommended removing it.'
};
export const treatmentDescriptions={General:'Questions about any recommended treatment: timing, alternatives, and talking with the dentist.',Crowns:'Understanding a crown recommendation and the return visit.',Fillings:'Repairing decay and planning the recommended restoration.','Root canals':'Understanding treatment and the visits in the care plan.','Gum care':'Deep cleaning, gum treatment, and follow-up visits.',Extractions:'Understanding a removal recommendation and discussing options.',Implants:'General information about replacing missing teeth.',Bridges:'Understanding fixed tooth replacements and discussing options.'};
