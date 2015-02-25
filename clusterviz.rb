require 'open3'
require 'json'
require 'sinatra'
require 'sinatra/contrib'
require 'sinatra/base'
require 'timeout'
require 'neography'
require 'set'

def get_all_nodes(cluster)
  nodes = {}
  $types = {}
  $types[cluster] = $neo[cluster].execute_query("MATCH (:OBJECT)-[r:LINK]->(:OBJECT) RETURN COLLECT(distinct r.type)")["data"][0][0]

  $neo[cluster].execute_query("MATCH (n:OBJECT) RETURN n")['data'].each do |node|
    id = node[0]['metadata']['id']
    nodes[id] = node[0]['data']
  end
  
  $neo[cluster].execute_query("MATCH (n:OBJECT)-[rel:LINK]->(a:OBJECT) RETURN id(n), count(a)")['data'].each do |pair|
    nodes[pair[0]]['out_relations_count'] = pair[1]
  end

  # nodes.each do |node|
  #   sum = 0
  #   node['out_relations_count'].each do |k, v|
  #     sum += v.to_i
  #   end
  #   node['out_relations_count']['all'] = sum
  # end

  # $types = types
  nodes
end

configure do
  set :port, 4568
  puts 'configure() starts'
  $neo = {}
  $neo[:cheb] = Neography::Rest.new('http://graphit.parallel.ru:7474')
  $neo[:lom] = Neography::Rest.new('http://stat1.lom.parallel.ru:7474')

  $nodes = {}
  $nodes[:cheb] = get_all_nodes(:cheb)
  $nodes[:lom] = get_all_nodes(:lom)
  puts 'configure() ends'
end

def error_page msg
  erb :error, :locals => {:msg => msg}
end

def get_id(url)
  url.gsub(/.*\D/, '').to_i
end

def get_out_relationships(cluster, id, type)
  $neo[cluster].execute_query("START n=node(#{id}) MATCH (n)-[rel:LINK {type: '#{type}'}]->() RETURN rel")['data'].map do |rel|
    {
      source: get_id(rel[0]["start"]),
      target: get_id(rel[0]["end"])
    }
  end
end

def get_roots(cluster, type)
  query = "MATCH (n:OBJECT) WHERE (n)-[:LINK {type: '#{type}'}]->() AND NOT ()-[:LINK {type: '#{type}'}]->(n) RETURN n"
  $neo[cluster].execute_query(query)['data'].map do |node|
    node[0]['metadata']['id']
  end
end

def get_levels(cluster, type, levels)
  roots = get_roots(cluster, type)
  rels = []
  
  rels[0] = roots.map{ |root| get_out_relationships(cluster, root, type) }.reduce(:+)
  (0...levels - 1).each do |i|
    rels[i + 1] = []
    rels[i].each do |rel|
      rels[i + 1] += get_out_relationships(cluster, rel[:target], type)
      #puts "#{i + 1} #{rels[i + 1].size}"
    end
    #puts "#{i} #{rels[i].size}"
  end
  rels
end

def get_links(rels)
  rels.map do |rel|
    {
      source: get_id(rel['start']),
      target: get_id(rel['end']),
      type: rel['data']['type']
    }
  end
end 

def get_graph(cluster, links, nodes = [])
  nodes = Set.new nodes
  links.each do |link|
    nodes.add(link[:source])
    nodes.add(link[:target])
  end

  nodes = nodes.to_a
  nodes.map! do |node|
    {id: node, size: 10, type: $nodes[cluster][node]['type']}
  end
  
  {nodes: nodes, links: links}
end

get '/node-info/:id' do
  content_type :json
  $nodes[params[:cluster].to_sym][params[:id].to_i].to_json
end

get '/node-out-relations/:id' do 
  type = params[:type]
  cluster = params[:cluster].to_sym
  type = 'contain' unless type

  rels = get_out_relationships(cluster, params[:id], type)
  get_graph(cluster, rels).to_json
end 

get '/neo' do
  cluster = params[:cluster].to_sym
  levels_number = params[:levels].to_i
  if (levels_number == 0)
    roots = get_roots(cluster, params[:type])
    get_graph(cluster, [], roots).to_json
  else  
    levels = get_levels(cluster, params[:type], levels_number)
    rels = levels.reduce(:+)
    get_graph(cluster, rels).to_json
  end
end

get '/about' do
  erb :about
end

get '/contact' do
  erb :contact
end

get '/' do
  erb :start
end

not_found do
  error_page '404'
end
