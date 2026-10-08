export const treatmentTopics=['Crowns','Fillings','Root canals','Gum care','Extractions','Implants','Bridges'];
const nhs='NHS · Dental treatments · https://www.nhs.uk/live-well/healthy-teeth-and-gums/dental-treatments/';
const definitions=[
 ['Fillings','filling','What does a filling do?','A filling repairs a hole in a tooth caused by decay. Your dentist chooses the material based on your tooth and treatment needs.',nhs],
 ['Root canals','root-canal','What does root canal treatment do?','Root canal treatment cleans and seals the inside of a tooth to treat infection and help keep the tooth. Your dentist will explain the plan for restoring the tooth afterward.','ADA · Root canals · https://www.mouthhealthy.org/all-topics-a-z/root-canals'],
 ['Gum care','gum-care','What is a deep cleaning?','Scaling and root planing is a cleaning below the gumline used to treat gum disease. It removes plaque and tartar and smooths the root surfaces.','ADA · Scaling and root planing · https://www.mouthhealthy.org/all-topics-a-z/scaling-and-root-planing/'],
 ['Extractions','extraction','Why was an extraction recommended?','The reason for removing a tooth comes from your dentist’s assessment. I can explain the recorded recommendation and help arrange a discussion before you decide.','Patient treatment plan'],
 ['Implants','implant','What does a dental implant do?','An implant is placed in the jaw to support a replacement tooth or other dental restoration. Your dentist will discuss whether it is appropriate for you.',nhs],
 ['Bridges','bridge','What does a dental bridge do?','A bridge is a fixed replacement for one or more missing teeth. Your dentist will explain how it would be supported and whether it suits your situation.',nhs]
];
export const treatmentEntries=definitions.flatMap(([topic,slug,question,answer,source])=>[
 {id:`kb-${slug}-overview`,topic,question,answer,source,chart:['Fillings','Root canals','Gum care','Extractions'].includes(topic)},
 {id:`kb-${slug}-visit`,topic,question:`What should I expect at my ${topic==='Gum care'?'gum care':topic==='Root canals'?'root canal':slug} appointment?`,answer:'The team will review your recorded treatment plan and answer your questions before starting. I can check the planned visit length and provider when helping you book.',source:'Practice scheduling guidance',chart:false},
 {id:`kb-${slug}-alternatives`,topic,question:`What are the alternatives to ${topic.toLowerCase()}?`,answer:'Your dentist needs to compare the options using your examination and treatment history. I can help arrange that discussion before you decide.',source:'Practice communication guidance',dentist:true,chart:false}
]);
// Fixed fictional examples, grounded in the prototype's existing patient charts.
export const chartExamples={
 Crowns:'Dr. Lee noted a crack in tooth 30 and recommended a crown to protect and support the remaining tooth.',
 Fillings:'Dr. Lee recorded decay in tooth 14 and recommended a filling.',
 'Root canals':'Dr. Lee recommended root canal treatment for tooth 19 after your assessment.',
 'Gum care':'After your gum assessment, Dr. Lee recommended periodontal therapy for the lower-right area.',
 Extractions:'Dr. Lee recorded that tooth 16 could not be restored and recommended removing it.'
};
export const treatmentDescriptions={Crowns:'Understanding a crown recommendation and the return visit.',Fillings:'Repairing decay and planning the recommended restoration.','Root canals':'Understanding treatment and the visits in the care plan.','Gum care':'Deep cleaning, gum treatment, and follow-up visits.',Extractions:'Understanding a removal recommendation and discussing options.',Implants:'General information about replacing missing teeth.',Bridges:'Understanding fixed tooth replacements and discussing options.'};
